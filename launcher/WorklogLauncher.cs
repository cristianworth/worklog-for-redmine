using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Program
{
    internal static readonly string Root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    internal static readonly string Instance = Identity(Root.ToLowerInvariant());
    internal static readonly uint ActivateMessage = Native.RegisterWindowMessage("Worklog.Activate." + Instance);

    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        bool created;
        using (var mutex = new Mutex(true, "Local\\Worklog.Launcher." + Instance, out created))
        {
            if (!created)
            {
                Native.PostMessage(new IntPtr(0xffff), ActivateMessage, IntPtr.Zero, IntPtr.Zero);
                return 0;
            }
            if (args.Length == 1 && args[0] == "--check")
            {
                try { ValidateRoot(); FindNode(); return 0; }
                catch { return 1; }
            }
            Application.Run(new LauncherWindow());
            mutex.ReleaseMutex();
        }
        return 0;
    }

    private static string Identity(string value)
    {
        using (var hash = SHA256.Create())
            return BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-", "");
    }

    internal static void ValidateRoot()
    {
        if (!File.Exists(Path.Combine(Root, "package.json")) || !File.Exists(Path.Combine(Root, "scripts", "launch-worklog.mjs")))
            throw new InvalidOperationException("Coloque Worklog.exe junto de package.json, na pasta completa do projeto.");
    }

    internal static string FindNode()
    {
        var candidates = new List<string>();
        foreach (string directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            if (!String.IsNullOrWhiteSpace(directory))
                candidates.Add(Path.Combine(directory.Trim().Trim('"'), "node.exe"));
        }
        candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"));
        foreach (string candidate in candidates)
        {
            if (!File.Exists(candidate)) continue;
            var info = new ProcessStartInfo(candidate, "--version");
            info.UseShellExecute = false; info.CreateNoWindow = true; info.RedirectStandardOutput = true;
            using (var process = Process.Start(info))
            {
                if (!process.WaitForExit(5000)) { process.Kill(); continue; }
                Version version;
                string text = process.StandardOutput.ReadToEnd().Trim().TrimStart('v');
                if (Version.TryParse(text, out version) && version.Major == 24 && version.Minor >= 20)
                    return candidate;
            }
        }
        throw new InvalidOperationException("Node.js compatível não encontrado. Instale Node.js 24.20 ou mais recente da linha 24.x, com npm, em https://nodejs.org/ e reabra o lançador.");
    }
}

internal sealed class LauncherWindow : Form
{
    private readonly Label status = new Label();
    private readonly TextBox history = new TextBox();
    private readonly Button open = new Button();
    private readonly Button retry = new Button();
    private readonly Button stop = new Button();
    private readonly ProgressBar progress = new ProgressBar();
    private readonly NotifyIcon tray = new NotifyIcon();
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();
    private Process worker;
    private Native.ProcessJob job;
    private string url;
    private bool exitRequested, allowClose, reportedError;

    internal LauncherWindow()
    {
        Text = "Worklog for Redmine"; Icon = SystemIcons.Application;
        Size = new Size(680, 430); MinimumSize = new Size(600, 400);
        StartPosition = FormStartPosition.CenterScreen; Font = new Font("Segoe UI", 10);
        AutoScaleMode = AutoScaleMode.Dpi;
        status.SetBounds(20, 20, 620, 55); status.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        status.Text = "Conferindo o projeto e o Node.js…";
        progress.SetBounds(20, 80, 620, 12); progress.Anchor = status.Anchor; progress.Style = ProgressBarStyle.Marquee;
        history.SetBounds(20, 105, 620, 185); history.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        history.Multiline = true; history.ReadOnly = true; history.ScrollBars = ScrollBars.Vertical;
        open.Text = "Abrir navegador"; open.SetBounds(20, 310, 165, 36); open.Enabled = false;
        retry.Text = "Tentar novamente"; retry.SetBounds(195, 310, 165, 36); retry.Enabled = false;
        stop.Text = "Cancelar e sair"; stop.SetBounds(370, 310, 170, 36);
        foreach (var button in new Button[] { open, retry, stop }) button.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;
        var hint = new Label(); hint.SetBounds(20, 355, 620, 35); hint.Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        hint.Text = "Fechar esta janela minimiza para a bandeja. Sair encerra apenas o serviço iniciado aqui.";
        Controls.AddRange(new Control[] { status, progress, history, open, retry, stop, hint });
        open.Click += delegate { OpenBrowser(); };
        retry.Click += async delegate { await StartWorker(); };
        stop.Click += delegate { StopWorker(); };
        var menu = new ContextMenuStrip();
        menu.Items.Add("Mostrar lançador", null, delegate { Restore(); });
        menu.Items.Add("Abrir navegador", null, delegate { OpenBrowser(); });
        menu.Items.Add("Sair", null, delegate { StopWorker(); });
        tray.Icon = Icon; tray.Text = "Worklog for Redmine"; tray.ContextMenuStrip = menu; tray.Visible = true;
        tray.DoubleClick += delegate { Restore(); };
        FormClosing += delegate(object sender, FormClosingEventArgs e)
        {
            if (!allowClose && worker != null && !worker.HasExited) { e.Cancel = true; Hide(); }
        };
        Shown += async delegate { await StartWorker(); };
        FormClosed += delegate { tray.Dispose(); if (job != null) job.Dispose(); if (worker != null) worker.Dispose(); };
    }

    protected override void WndProc(ref Message message)
    {
        if (message.Msg == Program.ActivateMessage) Restore();
        base.WndProc(ref message);
    }

    private void Restore() { Show(); WindowState = FormWindowState.Normal; Activate(); }
    private void Ui(Action action)
    {
        if (!IsDisposed && IsHandleCreated) BeginInvoke(action);
    }
    private void Report(string message) { status.Text = message; history.AppendText(message + Environment.NewLine); }

    private async Task StartWorker()
    {
        if (worker != null && !worker.HasExited) return;
        retry.Enabled = false; open.Enabled = false; stop.Enabled = true; stop.Text = "Cancelar e sair";
        progress.Style = ProgressBarStyle.Marquee; exitRequested = false; reportedError = false; url = null;
        try
        {
            Program.ValidateRoot();
            string node = await Task.Run(() => Program.FindNode());
            if (job != null) job.Dispose();
            if (worker != null) worker.Dispose();
            job = new Native.ProcessJob();
            var info = new ProcessStartInfo(node, "\"" + Path.Combine(Program.Root, "scripts", "launch-worklog.mjs") + "\"");
            info.WorkingDirectory = Program.Root; info.UseShellExecute = false; info.CreateNoWindow = true;
            info.RedirectStandardInput = true; info.RedirectStandardOutput = true; info.RedirectStandardError = true;
            info.StandardOutputEncoding = Encoding.UTF8; info.StandardErrorEncoding = Encoding.UTF8;
            worker = new Process(); worker.StartInfo = info; worker.EnableRaisingEvents = true;
            worker.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
            {
                if (e.Data != null) Ui(() => HandleEvent(e.Data));
            };
            worker.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
            {
                if (e.Data != null) Ui(() => history.AppendText(e.Data + Environment.NewLine));
            };
            worker.Exited += delegate { Ui(() => {
                open.Enabled = false; retry.Enabled = true; stop.Enabled = true; progress.Style = ProgressBarStyle.Blocks;
                stop.Text = "Fechar";
                if (exitRequested) { allowClose = true; Close(); }
                else if (!reportedError) Report("O lançador encerrou. Confira local/launcher.log se a inicialização não foi concluída.");
            }); };
            worker.Start();
            // The worker waits for 'go', so every descendant inherits this job before npm starts.
            job.Assign(worker);
            worker.BeginOutputReadLine(); worker.BeginErrorReadLine();
            worker.StandardInput.WriteLine("go"); worker.StandardInput.Flush();
        }
        catch (Exception error)
        {
            if (job != null) { job.Dispose(); job = null; }
            Report(error.Message); reportedError = true; retry.Enabled = true; stop.Text = "Fechar";
            progress.Style = ProgressBarStyle.Blocks;
        }
    }

    private void HandleEvent(string line)
    {
        try
        {
            var value = json.Deserialize<Dictionary<string, object>>(line);
            string kind = Convert.ToString(value["type"]);
            if (value.ContainsKey("message")) Report(Convert.ToString(value["message"]));
            if (kind == "ready")
            {
                url = Convert.ToString(value["url"]); open.Enabled = true;
                progress.Style = ProgressBarStyle.Blocks;
                stop.Text = Convert.ToBoolean(value["managed"]) ? "Encerrar e sair" : "Fechar lançador";
                OpenBrowser();
            }
            if (kind == "stop-refused") { exitRequested = false; stop.Enabled = true; Restore(); }
            if (kind == "error") { reportedError = true; retry.Enabled = true; progress.Style = ProgressBarStyle.Blocks; Restore(); }
        }
        catch (Exception) { Report("Não foi possível interpretar a resposta do lançador. Confira local/launcher.log."); }
    }

    private void OpenBrowser()
    {
        if (String.IsNullOrEmpty(url)) return;
        Uri target;
        if (!Uri.TryCreate(url, UriKind.Absolute, out target) || target.Scheme != "http" || target.Host != "127.0.0.1") return;
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception) { Report("O serviço está pronto. Abra este endereço no navegador: " + url); }
    }

    private void StopWorker()
    {
        if (worker == null || worker.HasExited) { allowClose = true; Close(); return; }
        exitRequested = true; stop.Enabled = false; Report("Encerrando. Aguarde a conclusão das operações em andamento…");
        try { worker.StandardInput.WriteLine("stop"); worker.StandardInput.Flush(); }
        catch (Exception) { exitRequested = false; stop.Enabled = true; Report("Não foi possível solicitar o encerramento. Confira o serviço antes de fechar."); }
    }
}

internal static class Native
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern uint RegisterWindowMessage(string message);
    [DllImport("user32.dll")] internal static extern bool PostMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int kind, IntPtr value, uint size);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits
    {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    internal sealed class ProcessJob : IDisposable
    {
        private IntPtr handle;
        internal ProcessJob()
        {
            handle = CreateJobObject(IntPtr.Zero, null);
            var limits = new ExtendedLimits(); limits.BasicLimitInformation.LimitFlags = 0x2000;
            int size = Marshal.SizeOf(limits); IntPtr memory = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(limits, memory, false);
                if (handle == IntPtr.Zero || !SetInformationJobObject(handle, 9, memory, (uint)size))
                {
                    Dispose();
                    throw new InvalidOperationException("Não foi possível preparar o controle dos processos do Worklog.");
                }
            }
            finally { Marshal.FreeHGlobal(memory); }
        }
        internal void Assign(Process process)
        {
            if (!AssignProcessToJobObject(handle, process.Handle))
            {
                process.Kill();
                throw new InvalidOperationException("O Windows não permitiu controlar o processo do lançador.");
            }
        }
        public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } }
    }
}

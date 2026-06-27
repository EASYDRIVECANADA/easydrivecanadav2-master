EasyDrive Facebook Assistant

This package installs the local browser assistant used by EasyDrive Admin > Marketplace > Facebook.

Install:
1. Download install.ps1 from the EasyDrive dashboard.
2. Right-click the file and run it with PowerShell.
3. If Windows asks for permission, approve it.
4. Wait until the script says the assistant was installed.
5. Go back to EasyDrive Admin and click Check Again.

What it does:
- Installs the assistant files under your Windows LocalAppData folder.
- Installs the required Playwright dependency.
- Creates a Windows Scheduled Task named EasyDrive Facebook Assistant.
- Starts the assistant automatically when this Windows user logs in.

The assistant does not store your Facebook password and does not click the final Facebook Post button.

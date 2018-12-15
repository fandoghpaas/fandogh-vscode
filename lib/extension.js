// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fandogh = require('fandogh')
const Client = require('./client')
const client = new Client()
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
 
function activate(context) {

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
  let user_login = vscode.commands.registerCommand('extension.login', async function () {   
      await client.login(context)
  });

  let create_service = vscode.commands.registerCommand('extension.create_service', async function () {      
    await client.createService(context)
  });

  let open_file = vscode.commands.registerCommand('extension.open_file', async function() {
    await client.openFile(context)
  })

  context.subscriptions.push(user_login);
  context.subscriptions.push(create_service);
  context.subscriptions.push(open_file)
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
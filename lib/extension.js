// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fandogh = require('fandogh')
const Client = require('./client')
const {login, createImage, createVersion, createService, openFile} = new Client()
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "fandogh-vscode" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let user_login = vscode.commands.registerCommand('extension.login', async function () {   
       await login(context)
    });

    let create_version = vscode.commands.registerCommand('extension.create_version', async function () {      
      await createVersion(context)
    });

   let create_image = vscode.commands.registerCommand('extension.create_image', async function () {      
     await createImage(context)
    
   });

  let create_service = vscode.commands.registerCommand('extension.create_service', async function () {      
    await createService(context)
  });

  let open_file = vscode.commands.registerCommand('extension.open_file', async function() {
    await openFile(context)
  })

  let deploy = vscode.commands.registerCommand('extension.deploy', async function () {
    await createImage(context, true)      
    await createVersion(context)
    await createService(context)
  });

  context.subscriptions.push(user_login);
  context.subscriptions.push(deploy);
  context.subscriptions.push(create_image);
  context.subscriptions.push(create_version);
  context.subscriptions.push(create_service);
  context.subscriptions.push(open_file)
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
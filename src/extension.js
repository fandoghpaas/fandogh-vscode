// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fandogh = require('fandogh')
const {login, createImage, createVersion} = require('./client')

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

    let deploy = vscode.commands.registerCommand('extension.deploy', async function () {      
      console.log('deploy')
   });


    context.subscriptions.push(user_login);
    context.subscriptions.push(deploy);
    context.subscriptions.push(create_image);
    context.subscriptions.push(create_version);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
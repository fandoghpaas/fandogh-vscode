const vscode = require('vscode');
const fandogh = require('fandogh')

const Client = {
  
  login: async (context) => {
    try {
      let username = await vscode.window.showInputBox({placeHolder: 'Username'})
      let password = await vscode.window.showInputBox({placeHolder: 'Password', password: true})
      let user = await fandogh.login({username, password})
      vscode.window.showInformationMessage('Logged in successfully');
      await context.globalState.update('fandogh.token', user.token)
      return user.token
    } catch(e){
        vscode.window.showErrorMessage(e.message)
        Promise.reject(e)
    }
  },
  createImage: async (context) => {
    try {
      let name = await vscode.window.showInputBox({placeHolder: 'Image Name'})
      let token = await context.globalState.get('fandogh.token')
      if(!token) {
        let error = 'please login to fandogh'
        vscode.window.showErrorMessage(error)
        return Promise.reject(error)
      }
      let image = await fandogh.createImage({name, token})
      vscode.window.showInformationMessage(image.message);
      await context.globalState.update('fandogh.image', name)
      return image
    } catch(e){
        vscode.window.showErrorMessage(e.message)
        Promise.reject(e)
    }
  },
  createVersion: async (context) => {
    try {

      let imageName =  await context.globalState.get('fandogh.image')

      let name = await vscode.window.showInputBox({placeHolder: 'Image Name', value: imageName || ''})
      let version  = await vscode.window.showInputBox({placeHolder: 'Image Version'})
      let token = await context.globalState.get('fandogh.token')
      if(!token) {
        let error = 'please login to fandogh'
        vscode.window.showErrorMessage(error)
        return Promise.reject(error)
      }
      version = await fandogh.createVersion({name, version, token, source: __dirname})
      vscode.window.showInformationMessage(version.message);
      await context.globalState.update('fandogh.image', name)
      return version
    } catch(e){
      if(e.message){
        vscode.window.showErrorMessage(e.message)
      } else {
        vscode.window.showErrorMessage(e)
      }
        Promise.reject(e)
    }
  }
}

module.exports = Client
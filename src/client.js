const vscode = require('vscode');
const fandogh = require('fandogh')

class Client {

  static async init(context){
    let token = await context.globalState.get('fandogh.token')
    if(!token) {
      let error = 'please login to fandogh'
      vscode.window.showErrorMessage(error)
      token = await Client.login(context)
    }
    return token
  }

  async login(context) {
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
  }
  async createImage(context) {
    try {
      let token = await Client.init(context)
      let name = await vscode.window.showInputBox({placeHolder: 'Image Name'})
      let image = await fandogh.createImage({name, token})
      vscode.window.showInformationMessage(image.message);
      await context.globalState.update('fandogh.image', name)
      return image
    } catch(e){
        vscode.window.showErrorMessage(e.message)
        Promise.reject(e)
    }
  }
  async createVersion(context){
    try {

      let token = await Client.init(context)

      let imageName =  await context.globalState.get('fandogh.image')
      let name = await vscode.window.showInputBox({placeHolder: 'Image Name', value: imageName || ''})
      let version  = await vscode.window.showInputBox({placeHolder: 'Image Version'})
      version = await fandogh.createVersion({name, version, token, source: __dirname})
      vscode.window.showInformationMessage(version.message);
      await context.globalState.update('fandogh.image', name)
      await context.globalState.update('fandogh.version', version)
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
  async createService (context){
    try {

      let token = await Client.init(context)

      let imageName =  await context.globalState.get('fandogh.image')
      let imageVersion =  await context.globalState.get('fandogh.version')
      let serviceName =  await context.globalState.get('fandogh.service')
      let name = await vscode.window.showInputBox({placeHolder: 'Image Name', value: imageName || ''})
      let version  = await vscode.window.showInputBox({placeHolder: 'Image Version', value: imageVersion || ''})
      let service  = await vscode.window.showInputBox({placeHolder: 'Image Version', value: serviceName || ''})
      service = await fandogh.createService({image_name: name, image_version: version, service_name: service, token})
      vscode.window.showInformationMessage(service.message);

      await context.globalState.update('fandogh.image', name)
      await context.globalState.update('fandogh.version', version)
      await context.globalState.update('fandogh.service', service)

      return service
      
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
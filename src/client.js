const vscode = require('vscode');
const fandogh = require('fandogh')

class Client {

  static async init(context){
    let token = await context.globalState.get('fandogh.token')
    if(!token) {
      let error = 'please login to fandogh'
      vscode.window.showErrorMessage(error)
      token = await new Client().login(context)
    }
    return token
  }

  static async updateState(states, context){
    await Promise.all(states.map(async state => {
      await context.globalState.update('fandogh.'+state.name, state.value)
    }))
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
      let name = await vscode.window.showInputBox({placeHolder: 'Enter image name'})
      let image = await fandogh.createImage({name, token})
      vscode.window.showInformationMessage(image);
      await Client.updateState([{name:'image', value: name}], context)
      return image
    } catch(e){
        vscode.window.showErrorMessage(e.message)
        Promise.reject(e)
    }
  }
  async createVersion(context){
    try {

      let token = await Client.init(context)
      let ws = vscode.workspace.workspaceFolders
      
      let imageName =  await context.globalState.get('fandogh.image')
      let name = await vscode.window.showInputBox({placeHolder: 'Enter image name', value: imageName || ''})
      let version  = await vscode.window.showInputBox({placeHolder: 'Enter image version'})
      let version_ = await fandogh.createVersion({name, version, token, source: ws[0].uri.fsPath})
      vscode.window.showInformationMessage(version_);
      await Client.updateState([{name:'image', value: name}, {name: 'version', value: version}], context)
      return version_
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
      let name = await vscode.window.showInputBox({placeHolder: 'Enter image Name', value: imageName || ''})
      let version  = await vscode.window.showInputBox({placeHolder: 'enter Image Version', value: imageVersion || ''})
      let service  = await vscode.window.showInputBox({placeHolder: 'Enter service name', value: serviceName || ''})
      let service_ = await fandogh.createService({image_name: name, image_version: version, service_name: service, token})
      vscode.window.showInformationMessage('service deployed successfully');
      vscode.window.showInformationMessage(service_.url);

      await Client.updateState([{name:'image', value: name}, {name: 'version', value: version}, {name: 'service', value: service}], context)

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
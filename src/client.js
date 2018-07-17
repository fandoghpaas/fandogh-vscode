const vscode = require('vscode');
const fandogh = require('fandogh')
const ws = vscode.workspace.workspaceFolders

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
  static async handleAutheticationError({error, context, method}) {
    vscode.window.showErrorMessage(error.message);
    await new Client().login(context)
    await new Client()[method](context)
  }
  async login(context) {
    try {
      let global_username = await context.globalState.get('fandogh.username')
      let global_password = await context.globalState.get('fandogh.password')
      let username = global_username || await vscode.window.showInputBox({placeHolder: 'Username'})
      let password = global_password || await vscode.window.showInputBox({placeHolder: 'Password', password: true})
      let user = await fandogh.login({username: username, password: password})
      vscode.window.showInformationMessage('Logged in successfully');
      await context.globalState.update('fandogh.token', user.token)
      await context.globalState.update('fandogh.username', username)
      await context.globalState.update('fandogh.password', password)
      return user.token
    } catch(e){
        vscode.window.showErrorMessage(e.message)
        Promise.reject(e)
    }
  }
  async createImage(context, isDeploy) {
    try {
      let config = await fandogh.config(ws[0].uri.fsPath)
      if(isDeploy && config['app.name']) {
        return vscode.window.showInformationMessage('Your app name: '+config['app.name']); 
      }
      let token = await Client.init(context)
      let name = await vscode.window.showInputBox({placeHolder: 'Enter image name'})
      let image = await fandogh.createImage({name, token, source: ws[0].uri.fsPath})
      vscode.window.showInformationMessage(image);
      await Client.updateState([{name:'image', value: name}], context)
      return image
    } catch(e){
        if(e.code === 401){
          await Client.handleAutheticationError({error: e.error, context, method:'createImage'})
        } else {
          let error = e.error
          if(typeof error === 'string'){
            vscode.window.showErrorMessage(error)
          } else {
            if(error['name']){
              vscode.window.showErrorMessage(error['name'][0])
            }
          }
          Promise.reject(e)
        }
    }
  }
  async createVersion(context){
    try {
      let token = await Client.init(context)
      let config = await fandogh.config(ws[0].uri.fsPath)
      let imageName =  await context.globalState.get('fandogh.image')
      if(config && config['app.name']){
        imageName = config['app.name']
      }
      let name = imageName || await vscode.window.showInputBox({placeHolder: 'Enter image name'})
      let version  = await vscode.window.showInputBox({placeHolder: 'Enter image version'})
      let version_ = await fandogh.createVersion({name, version, token, source: ws[0].uri.fsPath})
      vscode.window.showInformationMessage(version_);
      await Client.updateState([{name:'image', value: name}, {name: 'version', value: version}], context)
      return version_
    } catch(e){
      if(e.code === 401){
        await Client.handleAutheticationError({error: e.error, context, method:'createVersion'})
      }
      else {
        let error = e.error
        if(error.message){
          vscode.window.showErrorMessage(error.message)
        } else {
          vscode.window.showErrorMessage(error)
        }
        if(e.code === 'dockerfile-404') throw error
        Promise.reject(e)
      }
    }
  }
  async createService (context){
    try {

      let token = await Client.init(context)
      let config = await fandogh.config(ws[0].uri.fsPath)
      let imageName =  await context.globalState.get('fandogh.image')
      if(config && config['app.name']){
        imageName = config['app.name']
      }
      let imageVersion =  await context.globalState.get('fandogh.version')
      let serviceName =  await context.globalState.get('fandogh.service')
      let name = imageName || await vscode.window.showInputBox({placeHolder: 'Enter image Name'})
      let version  = await vscode.window.showInputBox({placeHolder: 'enter Image Version', value: imageVersion || ''})
      let service  = await vscode.window.showInputBox({placeHolder: 'Enter service name', value: serviceName || ''})
      let service_ = await fandogh.createService({image_name: name, image_version: version, service_name: service, token, source: ws[0].uri.fsPath})
      vscode.window.showInformationMessage('service deployed successfully');
      vscode.window.showInformationMessage(service_.url);

      await Client.updateState([{name:'image', value: name}, {name: 'version', value: version}, {name: 'service', value: service}], context)

      return service
      
    } catch(e){
      if(e.code === 401){
        await Client.handleAutheticationError({error: e.error, context, method:'createService'})
      }
      else {
        let error = e.error
        if(e.message){
          vscode.window.showErrorMessage(error.message)
        } else {
          vscode.window.showErrorMessage(error)
        }
          Promise.reject(e)
      }
    }
  }

}

module.exports = Client
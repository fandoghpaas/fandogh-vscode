const vscode = require('vscode');
const fandogh = require('fandogh')
const Path = require('path')
const ws = vscode.workspace.workspaceFolders;

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
  /**
   * 
   * @param {Array} states 
   * @param {Object} context 
   */
  static async updateState(states, context){
    await Promise.all(states.map(async state => {
      await context.globalState.update('fandogh.'+state.name, state.value)
    }))
  }
  static async handleAutheticationError({error, context, method}) {
    try {
      vscode.window.showErrorMessage(error.message);
      await new Client().login(context)
    } catch(e){
      // recursive call login method, until user has been login.
      return Client.handleAutheticationError({error, context, method})
    }
    await new Client()[method](context)
  }
  // get image and version from pattern
  getImageVersion(imageVersion){
    let array = imageVersion.split(':')
    return  array.length ? array : []
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
      if(isDeploy && config['spec.image']) {
        const [imageName, imageVersion] = Client.getImageVersion(config['spec.image'])
        if(isDeploy){
          return vscode.window.showInformationMessage('Your last image name: '+imageName); 
        }
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
      if(config && config['spec.image']){
        const [image, version] = Client.getImageVersion(config['spec.image'])
        if(image){
          imageName = image
        }
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
      let imageVersion =  await context.globalState.get('fandogh.version')
      if(config && config['spec.image']){
        const [image, version] = Client.getImageVersion(config['spec.image'])
        if(image) imageName = image;
        if(version) imageVersion = version;
      }

      let serviceName =  await context.globalState.get('fandogh.service')
      let name = imageName || await vscode.window.showInputBox({placeHolder: 'Enter image Name', value: imageName || ''})
      let version  = imageVersion || await vscode.window.showInputBox({placeHolder: 'Enter Image Version', value: imageVersion || ''})

      // check workspace config project
      config['spec.image'] = name+':'+version;
      config['kind'] = config['kind'] || 'ExternalService';
      await fandogh.createYaml({source: ws[0].uri.fsPath, configs: config})
      // open yaml config file
      await Client.openFile()

      // deploy
      let service  = await vscode.window.showInputBox({placeHolder: 'Enter service name', value: serviceName || ''})
      // save service name in yaml config
      config['name'] = serviceName;
      await fandogh.createYaml({source: ws[0].uri.fsPath, configs: config})
      // deploy service with manifset
      let service_ = await fandogh.createServiceManifest({manifest: config, token})
      // display information of deployed service
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

  async openFile(){
    try {
      const filePath = 'file://'+Path.join(vscode.workspace.rootPath, '.fandogh/config.yaml')
      const openPath = vscode.Uri.parse(filePath); //A request file path
      const doc = await vscode.workspace.openTextDocument(openPath)
    console.log(doc)
    } catch(e) {
      console.log(e)
    }
  }

}

module.exports = Client
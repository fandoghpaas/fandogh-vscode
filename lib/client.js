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
  async createImage(context) {
    try {
      // create new image with simply input box
      let token = await Client.init(context)
      let name = await vscode.window.showInputBox({placeHolder: 'Enter image name'})
      let image = await fandogh.createImage({name, token, source: ws[0].uri.fsPath})
      vscode.window.showInformationMessage(image);
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

  progressEvent(event, progress){
    let count = 0
    return new Promise((resolve, reject) => {
      event.on('uploadProgress', async prog => {
        let percent = prog.percent * 100;
        progress.report({increment: Math.ceil(percent - count), message: Math.floor(percent)+'%'})
        count += percent
      }).on('finish', () => {
        resolve('finished.')
      })
    })
  }

  async showVersionLogs({image, version, context}){
    let token = await Client.init(context)
    const {logs, state} = await fandogh.versionLogs({token, image, version})
    let outputChannel = vscode.window.createOutputChannel('image-logs')
    outputChannel.append(logs)
    outputChannel.show()

    setTimeout(function logInterval(){
      fandogh.versionLogs({token, image, version}).then(log => {
        outputChannel.clear();
        outputChannel.append(log.logs)
      })
      if(log.state.toLowerCase() === 'building') setTimeout(logInterval(), 3000)
     // building
    },3000)

    return logs;
  }
 
  async createVersion(context, imageName){
    try {
      let token = await Client.init(context)

      let version  = await vscode.window.showInputBox({placeHolder: 'Enter image version'})
      let versionEvent = await fandogh.createVersion({name: imageName, version, token, source: ws[0].uri.fsPath})

      await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Uploading your app... "
        }, async (progress) => {
          await this.progressEvent(versionEvent, progress)
        })
      vscode.window.showInformationMessage('Your version created.');

      // show version build logs in vscode output channel
      await this.showVersionLogs({image: imageName, context, version});

      return true
    } catch(e){
      console.log(e)
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

  manisetToJson(manifest){
    // test.reza
    // test [reza]
    const manifestKeys = Object.keys(manifest)
    let json = {}
    manifestKeys.forEach(element => {
      const props = element.split('.')
      if(props.length == 2){
        if(!json[props[0]]) json[props[0]] = {} 
        json[props[0]][props[1]] = manifest[element]
      } else {
        json[props[0]] = manifest[element]
      }
    });
    return json;
  }

  async createService (context){
    try {

      let token = await Client.init(context)
      let config = await fandogh.config(ws[0].uri.fsPath) || {}
   
      // get list of images and show quikePick input
      let images = (await fandogh.images({token})).map(item => item.name)
      images.unshift('[ Create new image ]');
      let image = await vscode.window.showQuickPick(images, {placeHolder: 'Select or create an image'})
       // create new image if [ Create new image ] has been selected
      if(image === '[ Create new image ]'){
        await this.createImage(context);
        return await this.createService(context);
      }

      // get list of versions and show quikePick input
      let versions = (await fandogh.versions({token, name: image}));
      versions = versions.map(item => `[${item.state.toLowerCase()}] ${item.version}`)
      versions.push('[ Create new version ]');
      versions.reverse();

      let version = await vscode.window.showQuickPick(versions, {placeHolder:'Select version of image'})

      if(version === '[ Create new version ]'){
        await this.createVersion(context, image);
        return await this.createService(context);
      }

      // check workspace config project
      config['spec.image'] = image+':'+version;
      config['kind'] = config['kind'] || 'ExternalService';
      await fandogh.createYaml({source: ws[0].uri.fsPath, configs: config})
      // open yaml config file
      await this.openFile()

      const services = (await fandogh.services({token})).map(item => item.name);
      services.push('[ Create new service ]')
      services.reverse()
      let service = await vscode.window.showQuickPick(services, {placeHolder:'Select or create a service'})
      // deploy
      if(service === '[ Create new service ]') service = await vscode.window.showInputBox({placeHolder: 'Enter service name'})
      
      // save service name in yaml config
      config['name'] = service;
      await fandogh.createYaml({source: ws[0].uri.fsPath, configs: config})
      // deploy service with manifset
      let service_ = await fandogh.createServiceManifest({manifest: this.manisetToJson(config) , token})
      // display information of deployed service
      vscode.window.showInformationMessage('service deployed successfully');
      vscode.window.showInformationMessage(service_.url);

      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(service_.url))

      return service
      
    } catch(e){
      console.log(e)
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
      const filePath = 'file://'+Path.join(vscode.workspace.rootPath, '.fandogh/config.yml')
      const openPath = vscode.Uri.parse(filePath); //A request file path
      const doc = await vscode.workspace.openTextDocument(openPath)
      vscode.window.showTextDocument(doc)
    } catch(e) {
      console.log(e)
    }
  }

}

module.exports = Client
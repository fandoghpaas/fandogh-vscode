const vscode = require('vscode');
const fandogh = require('fandogh')
const Path = require('path')
const ws = vscode.workspace.workspaceFolders;
const EventEmitter = require('events').EventEmitter;
const emitter = new EventEmitter();
const config = vscode.workspace.getConfiguration('launch', vscode.window.activeTextEditor.document.uri);

class Client {

  static async init(context){
    let token = await config.get('fandogh.token')
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
      await config.update('fandogh.'+state.name, state.value)
    }))
  }
  static async handleAutheticationError({error, context, method}) {
    try {
      this.endLoading();
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

  /**
   *
   * @param context
   * @param forceLogin
   * @returns {Promise<*>}
   */
  async login(context, forceLogin) {
    try {
      let local_username = await config.get('fandogh.username')
      let local_password = await config.get('fandogh.password')
      let username = (local_username && !forceLogin) || await vscode.window.showInputBox({placeHolder: 'Username'})
      let password = (local_password && !forceLogin) || await vscode.window.showInputBox({placeHolder: 'Password', password: true})
      this.loading();
      let user = await fandogh.login({username: username, password: password})
      this.endLoading();
      vscode.window.showInformationMessage('Logged in successfully');
      await config.update('fandogh.token', user.token)
      await config.update('fandogh.username', username)
      await config.update('fandogh.password', password)
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
      this.loading()
      let image = await fandogh.createImage({name, token, source: ws[0].uri.fsPath})
      this.endLoading()
      vscode.window.showInformationMessage(image);
      return image
    } catch(e){
        if(e.statusCode === 401 || e.statusCode === 500){
          await Client.handleAutheticationError({error: e.error, context, method:'createImage'})
        } else {
          let error = e.error
          this.errorReporter(error.body)
          Promise.reject(e)
        }
    }
  }

  /**
   *
   * @param context
   * @param imageName
   * @returns {Promise<boolean>}
   */
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
      if(!e) return 
      console.log(e)
      if(e.statusCode === 401 || e.statusCode === 500){
        await Client.handleAutheticationError({error: e.error, context, method:'createVersion'})
      }
      else {
        let error = e.error
        if(error.message){
          vscode.window.showErrorMessage(error.message)
        } else {
          this.errorReporter(error.body)
        }
        if(e.statusCode === 'dockerfile-404') throw error
        Promise.reject(e)
      }
    }
  }

  /**
   *
   * @param context
   * @returns {Promise<*>}
   */
  async createService (context){
    try {

      let token = await Client.init(context)
      let config = await fandogh.config(ws[0].uri.fsPath) || {}

      const {version, image} = await this.selectImageVersion({isService:true, context});

      // check workspace config project
      config['spec.image'] = image+':'+version;
      config['kind'] = config['kind'] || 'ExternalService';
      await fandogh.createYaml({source: ws[0].uri.fsPath, configs: config})
      // open yaml config file
      await this.openFile()
      this.loading()
      const services = (await fandogh.services({token})).map(item => item.name);
      services.push('[ Create new service ]')
      services.reverse()
      this.endLoading();
      let service = await vscode.window.showQuickPick(services, {placeHolder:'Select or create a service'})
      // deploy
      if(service === '[ Create new service ]') service = await vscode.window.showInputBox({placeHolder: 'Enter service name'})
      
      // save service name in yaml config
      config['name'] = service;
      await fandogh.createYaml({source: ws[0].uri.fsPath, configs: config})
      this.loading()
      // deploy service with manifset
      let service_ = await fandogh.createServiceManifest({manifest: this.manisetToJson(config) , token})
      this.endLoading()
      // display information of deployed service
      vscode.window.showInformationMessage('service deployed successfully');
      vscode.window.showInformationMessage(service_.url);

      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(service_.url))

      return service_
      
    } catch(e){
      if(!e.error) return this.endLoading();
      console.log(e)
      if(e.statusCode === 401 || e.statusCode === 500){
        await Client.handleAutheticationError({error: e.error, context, method:'createService'})
      }
      else {
        let error = e.error
        if(e.message){
          vscode.window.showErrorMessage(error.message)
        } else {
          this.errorReporter(error.body)
        }
          Promise.reject(e)
      }
    }
  }

  /**
   *
   * @param context
   * @returns {Promise<void>}
   */
  async versionLogs(context){
    const {version, image} = await this.selectImageVersion({context})
    await this.showVersionLogs({image, version, context})
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

  endLoading(){
    emitter.emit('loading')    
  }
  startLoading(){
    return new Promise((resolve, reject) => {
      emitter.on('loading', () => {
        resolve(true)
      })
    })
  }
  
  async loading(){
    return await vscode.window.withProgress({
      title: 'Please wait...',
      location: vscode.ProgressLocation.Notification
    }, async () =>{
      await this.startLoading();
    })
  }

  /**
   *
   * @param event
   * @param progress
   * @returns {Promise<any>}
   */
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

  /**
   *
   * @param image
   * @param version
   * @param context
   * @returns {Promise<never.logs>}
   */
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
        if(log.state.toLowerCase() === 'building') setTimeout(logInterval(), 2000)
      })

     // building
    },3000)

    return logs;
  }

  /**
   *
   * @param manifest
   */
  manisetToJson(manifest){
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

  /**
   *
   * @param isService
   * @param context
   * @returns {Promise<*>}
   */
  async selectImageVersion({isService, context}){
    let token = await Client.init(context)
    // get list of images and show quikePick input
    this.loading()
    let images = (await fandogh.images({token})).map(item => item.name)
    if(isService) images.unshift('[ Create new image ]');
    this.endLoading()
    let image = await vscode.window.showQuickPick(images, {placeHolder: 'Select or create an image'})
    // create new image if [ Create new image ] has been selected
    if(image === '[ Create new image ]' && isService){
      await this.createImage(context);
      return await this.createService(context);
    }

    this.loading()
    // get list of versions and show quikePick input
    let versions = (await fandogh.versions({token, name: image}));
    versions = versions.map(item => `[${item.state.toLowerCase()}] ${item.version}`)
    if(isService) versions.push('[ Create new version ]');
    versions.reverse();
    this.endLoading()
    let version = await vscode.window.showQuickPick(versions, {placeHolder:'Select version of image'})

    if(version === '[ Create new version ]' && isService){
      await this.createVersion(context, image);
      return await this.createService(context);
    }

    version = version.split('] ')[1]
    return {version, image};
  }

  /**
   *
   * @param apiError
   */
  errorReporter(apiError){
    this.endLoading()
    if(typeof apiError === 'object'){
      const errorValues = Object.values(apiError);
      errorValues.forEach(errors => {
        errors.forEach(error => {
          vscode.window.showErrorMessage(error)
        })
      })
    } else {
      vscode.window.showErrorMessage(message)
    }
  }

}

module.exports = Client
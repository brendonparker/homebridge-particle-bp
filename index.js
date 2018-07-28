var http = require('http');
var _ = require('lodash');
var Accessory, Service, Characteristic, UUIDGen;
var ACCESS_TOKEN = '';
var request = require('request');
module.exports = function (homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-particle-bp", "ParticlePlatform", ParticlePlatform, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function ParticlePlatform(log, config, api) {
  log("ParticlePlatform Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = [];
  ACCESS_TOKEN = this.config.accessToken;

  this.requestServer = http.createServer(function (request, response) {
    if (request.url === "/add") {
      this.addAccessory(new Date().toISOString());
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/reachability") {
      this.updateAccessoriesReachability();
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/remove") {
      this.removeAccessory();
      response.writeHead(204);
      response.end();
    }
  }.bind(this));

  this.requestServer.listen(18081, function () {
    platform.log("Server Listening...");
  });

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object
    this.api = api;

    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories.
    this.api.on('didFinishLaunching', function () {
      platform.log("DidFinishLaunching");
      var accessoryNames = _.map(this.accessories, 'displayName');
      platform.log(this.accessories);

      this.config.devices.forEach(device => {
        if (!_.includes(accessoryNames, device.name)) {
          this.addAccessory(device.name, device.id);
        }
      });
    }.bind(this));
  }
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
ParticlePlatform.prototype.configureAccessory = function (accessory) {
  this.log(accessory.displayName, "Configure Accessory");
  var platform = this;
  var deviceId = accessory.context.deviceId;
  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking 
  // accessory.updateReachability()
  accessory.reachable = true;

  accessory.on('identify', function (paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });

  if (accessory.getService(Service.Lightbulb)) {
    accessory.getService(Service.Lightbulb)
      .getCharacteristic(Characteristic.On)
      .on('set', function (value, callback) {
        invokeParticleApi(deviceId, "setMode", value ? "on" : "off");
        callback();
      });
  }

  this.accessories.push(accessory);
}

// Sample function to show how developer can add accessory dynamically from outside event
ParticlePlatform.prototype.addAccessory = function (deviceName, deviceId) {
  this.log("Add Accessory: " + deviceName);
  var platform = this;
  var uuid = UUIDGen.generate(deviceName);

  var newAccessory = new Accessory(deviceName, uuid);
  newAccessory.context.deviceId = deviceId;
  
  newAccessory.on('identify', function (paired, callback) {
    platform.log(newAccessory.displayName, "Identify!!!");
    callback();
  });
  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"

  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  newAccessory.addService(Service.Lightbulb, deviceName)
    .getCharacteristic(Characteristic.On)
    .on('set', function (value, callback) {
      invokeParticleApi(deviceId, "setMode", value ? "on" : "off");
      callback();
    });

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-particle-bp", "ParticlePlatform", [newAccessory]);
}

function invokeParticleApi(deviceId, command, args) {
  request({
    method: 'POST',
    url: `https://api.particle.io/v1/devices/${deviceId}/${command}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*.*',
      'Authorization': 'Bearer ' + ACCESS_TOKEN
    },
    form: { args: args }
  });
}
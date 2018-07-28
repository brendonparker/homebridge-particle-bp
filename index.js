var http = require('http');
var _ = require('lodash');
var Accessory, Service, Characteristic, UUIDGen;
var ACCESS_TOKEN = '';
var request = require('request');
var LOG;

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
  LOG = this.log = log;
  this.config = config;
  this.accessories = [];
  ACCESS_TOKEN = this.config.accessToken;

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

  WireUpAccessory(platform, accessory);

  var service = accessory.getService(Service.Lightbulb);

  if (service) {
    WireUpLightService(deviceId, service);
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

  WireUpAccessory(platform, newAccessory);

  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"

  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  var service = newAccessory.addService(Service.Lightbulb, deviceName);
  WireUpLightService(deviceId, service);

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-particle-bp", "ParticlePlatform", [newAccessory]);
}

function WireUpAccessory(platform, accessory) {
  accessory.on('identify', function (paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });
}

function WireUpLightService(deviceId, service) {
  var _h = .5, _s = .5, _l = .5, _updateTimeout;

  service.getCharacteristic(Characteristic.On)
    .on('set', function (value, callback) {
      invokeParticleApi(deviceId, "setMode", value ? "on" : "off")
      callback();
    });

  service.getCharacteristic(Characteristic.Hue)
    .on('set', function (value, callback) {
      updateHughBrightness(value / 360);
      callback();
    });

  service.getCharacteristic(Characteristic.Saturation)
    .on('set', function (value, callback) {
      updateHughBrightness(null, value / 100);
      callback();
    });

  service.getCharacteristic(Characteristic.Brightness)
    .on('set', function (value, callback) {
      clearTimeout(_updateTimeout);
      _updateTimeout = setTimeout(function () {
        invokeParticleApi(deviceId, "setBright", value);
      }, 800);
      callback();
    });

  function updateHughBrightness(hue, sat, light) {
    clearTimeout(_updateTimeout);
    if (hue != null) _h = hue;
    if (sat != null) _s = sat;
    if (light != null) _l = light;
    _updateTimeout = setTimeout(function () {
      var rgb = hslToRgb(_h, _s, _l);
      invokeParticleApi(deviceId, 'setRGB', rgb.join(' '));
    }, 1000);
  }
}

function hslToRgb(h, s, l) {
  var r, g, b;

  if (s == 0) {
    r = g = b = l; // achromatic
  } else {
    var hue2rgb = function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function invokeParticleApi(deviceId, command, args) {
  LOG(deviceId, command, args);
  return request({
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
# Running on Raspberry Pi:

Setup Instructions:
- install homebridge globally: `sudo npm install -g homebridge@0.4.38`
- install homebridge ui plugin: `sudo npm install -g homebridge-config-ui-x`

  This gives a nice UI that should come up on your network @ `http://raspberry.local:8080`
- clone this repo @ `/home/pi`: `git clone https://github.com/brendonparker/homebridge-particle-bp.git`

   Note: don't have to do it at `/home/pi`, but if it is somewhere else, make sure to update the path in the config that follows...
- `sudo nano /etc/default/homebridge` and paste this:

```
# Defaults / Configuration options for homebridge
# The following settings tells homebridge where to find the config.json file and where to persist the data (i.e. pairing and others)
HOMEBRIDGE_OPTS=-U /var/homebridge --plugin-path /home/pi

# If you uncomment the following line, homebridge will log more
# You can display this via systemd's journalctl: journalctl -f -u homebridge
DEBUG=*
```
- `sudo nano /etc/systemd/system/homebridge.service` and paste this:
```
[Unit]
Description=Node.js HomeKit Server 
After=syslog.target network-online.target

[Service]
Type=simple
User=homebridge
EnvironmentFile=/etc/default/homebridge
ExecStart=/usr/bin/homebridge $HOMEBRIDGE_OPTS
Restart=on-failure
RestartSec=10
KillMode=process

[Install]
WantedBy=multi-user.target
```
- Create a user to run service: `sudo useradd --system homebridge`
- `sudo mkdir /var/homebridge`
- `sudo cp ~/.homebridge/config.json /var/homebridge/`
  This copies your current user’s config. This assumes you have already added accessories etc.
- `sudo cp -r ~/.homebridge/persist /var/homebridge`
- `sudo chmod -R 0777 /var/homebridge`
- `sudo systemctl daemon-reload`
- `sudo systemctl enable homebridge`
- `sudo systemctl start homebridge`

Type `systemctl status homebridge` to check the status of the service.

Type `journalctl -f -u homebridge` to view the logs

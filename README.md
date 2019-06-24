# sounds-packer
Packs sounds for using in our current project setup. Right now built for internal use, maybe usefull for the world later...

# Installation
```
npm i @studiokloek/sounds-packer --save-dev
```

# Usage
Create a `asset.json` file in the root of your project, like the one below:

```
{
  "sounds": {
    "sourceDirectory" : "./assets/sounds", 
    "targetDirectory" : "./converted/sounds/",
    "scriptDirectory" : "./script/app/sounds/",
    "watch" : true,
    "watchDelay" : 2000,
    "directories": [
      "scenes",
      "world/player",
      "hud"
    ]
  }
}
```

# Under development
This module is currently under development and not ready for production.

//setup canvas
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
ctx.save()

//create variables
let canvasX, canvasY, canvasOffsetX, canvasOffsetY, 
screenX, screenY, currentLevel
let renderStack = {}
let playerInput = {
  keys:{
    allowed:[],
    current:{},
    log:[]
  },
  mouse:{
    scroll:{
      total: 0,
      log: [],
      last: {
        time: Date.now(),
        scroll: 0
      },
      speed:0
    },
    position:{
      log:[],
      current:{
        x:0,
        y:0,
        time:0
      }
    },
    buttons:{
      names:{},
      current:{},
      log:[]
    }
  }
}
playerInput.keys.allowed = ['tab', 'delete', 'escape', 'backspace', '0', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'l', 'k', 'j', 'h', 'g', 'f', 'd', 's', 'a', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'shift', ' ', 'enter', 'arrowright', 'arrowleft', 'arrowup', 'arrowdown']
playerInput.mouse.buttons.names = {0:"left",1:"middle",2:"right"}
let matterLinks = {}
let warp = false
let time = 0
let lastTime = 0
let updateindex = 0
const timePerSlide = 300
let cursed = Math.random() < .000001 ? true : false 
//there is a one-in-a-million chance that something will happen to the renderer

//make the canvas always fill the screen
function resize() {
  canvas.width = canvasX = window.innerWidth
  canvas.height = canvasY = window.innerHeight
  if (warp) {
    screenX = canvasX
    screenY = canvasY
    canvasOffsetX = 0
    canvasOffsetY = 0
  } else {
    screenX = Math.min(canvasY,canvasX)
    screenY = screenX
    canvasOffsetX = (canvasX - screenX) / 2
    canvasOffsetY = (canvasY - screenY) / 2
  }
}
window.onresize = resize
resize()

//setup Matter
let Engine = Matter.Engine,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Detector = Matter.Detector,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Common = Matter.Common,
    Vertices = Matter.Vertices;
    
// create an engine
let engine = Engine.create();

// create runner
let runner = Runner.create()

//takes care of creating stages if they don't exist yet
function addToRenderStack(input) {
  if (!renderStack[input.stage]) {renderStack[input.stage] = []}
  renderStack[input.stage].push(input)
}

//add a block to the Matter engine and link it in matterLinks
function addPhysicsObject(x ,y ,scale, block, options) {
  const physics = block.physics
  const points = physics.shape
  let bounds = {min:{x:x,y:y},max:{x:x,y:y}}
  bounds.min.x = points[0][0] * scale + x
  bounds.min.y = points[0][1] * scale + y
  bounds.max.x = points[0][0] * scale + x
  bounds.max.y = points[0][1] * scale + y

  options = options || {}
  let pointsList = ''
  for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
    const point = points[pointIndex]
    pointsList = pointsList + point[0] * scale + ' '
    pointsList = pointsList + point[1] * scale + ' '

    bounds.min.x = Math.min(bounds.min.x, point[0] * scale + x)
    bounds.min.y = Math.min(bounds.min.y, point[1] * scale + y)
    bounds.max.x = Math.max(bounds.max.x, point[0] * scale + x)
    bounds.max.y = Math.max(bounds.max.y, point[1] * scale + y)

  }
  const body = Bodies.fromVertices(x, y, Vertices.fromPath(pointsList), options, true)
  let offset = {min:{},max:{}}
  offset.min.x = bounds.min.x - body.bounds.min.x
  offset.min.y = bounds.min.y - body.bounds.min.y
  offset.max.x = bounds.max.x - body.bounds.max.x
  offset.max.y = bounds.max.y - body.bounds.max.y

  const radians = (block.angle * (Math.PI / 180)) || 0

  Matter.Body.setPosition(body, {x: x + offset.min.x - .5 * scale, y: y + offset.min.y - .5 * scale}, false)
  Matter.Body.rotate(body, radians)
  Composite.add(engine.world, [body])

  block.offset = offset
  block.link = body.id
  matterLinks[block.link] = block

}

//setting up a level
function initializeLevel(level) {

  //set the current level
  currentLevel = level

  //clear the matterLinks
  matterLinks = {}

  // create the engine for Matter
  engine = Engine.create();

  //create an empty array to store the blocks in
  let data = []

  //take care of any level specific setup functions
  if (level.setupFunc) {
    level.setupFunc(level)
  }
  
  for (let index = 0; index < level.layout.length; index++) {
    let block = level.key[level.layout[index].key]
    let functions
    if (block.functions) {
      functions = block.functions
    }
    data[index] = JSON.parse(JSON.stringify(block))
    if (functions) {
      data[index].functions = functions
    }
    const point = level.layout[index]
    data[index].position = {x: point.x, y: point.y, scale: point.scale}
  }
  level.data = data
  for (let index = 0; index < level.data.length; index++) {
    let block = level.data[index]

    let options
    if (level.layout[index].options) {
      options = level.layout[index].options
    }
    if (block.functions && block.functions.inputs) {
      block.functions.inputs(level.layout[index].inputs, level.data[index])
    }
    if (!Array.isArray(block) && block !== 0 && block.physics) {
      addPhysicsObject(block.position.x,block.position.y,block.position.scale,block,options)
    }
  }
}

//render everything on 
function render(inputOptions) {
  
  let options = {
    renderWireframes: false,
    renderCoverArt: true,
    renderBounds: false,
    debugMode: false,
    shake: {a:0,b:0},
    spin: {a:0,b:0}
  }
  inputOptions = inputOptions || {}
  for (let settingName in options) {
    if (inputOptions.hasOwnProperty(settingName)) {
      options[settingName] = inputOptions[settingName]
    }
  }

  //calculate render
  function setup() {
    //clear slate

    //grab all the bodies from Matter
    let matterBodies = Composite.allBodies(engine.world)

    // //render block art 
    if (options.renderCoverArt && !options.debugMode) {
      for (let matterBodyIndex in matterBodies) {
        const matterBody = matterBodies[matterBodyIndex]
        const matterBodyLink = matterBody.id
        for (let matterLinkIndex in matterLinks) {
          if (matterLinkIndex == matterBodyLink) {
            const block = matterLinks[matterBodyLink]
            const offset = block.offset
            const matterPosition = matterBody.position
            const scale = block.position.scale
            const origin = {}
            const art = block.coverArt
            const angle = matterBody.angle
            origin.x = matterPosition.x - offset.min.x + .5 * scale
            origin.y = matterPosition.y - offset.min.y + .5 * scale
            if (art && art.layers && art.layers[0]) {
              for (let layerIndex in art.layers) {

                //thank you chatGPT
                function rotatePoint(x, y, radians, center) {

                  // Translate the point to the origin
                  var translatedX = x - center.x;
                  var translatedY = y - center.y;
                
                  // Rotate the point around the origin
                  var rotatedX = translatedX * Math.cos(radians) - translatedY * Math.sin(radians);
                  var rotatedY = translatedX * Math.sin(radians) + translatedY * Math.cos(radians);
                
                  // Translate the point back to its original position
                  return {
                    x: rotatedX + center.x,
                    y: rotatedY + center.y
                  }
                }

                const layer = art.layers[layerIndex]
                const color = layer.color
                const rotationEffect = typeof(layer.rotationEffect) == "number" ? layer.rotationEffect : 1
                const outline = layer.outline
                let newPath = []
                if (color.length < 4) { color[3] = 1 }
                for (let pointIndex = 0; pointIndex < layer.steps.length + 2; pointIndex++) {
                  const point = layer.steps[pointIndex % layer.steps.length]
                  let x = (point[0] - .5) * scale + origin.x
                  let y = (point[1] - .5) * scale + origin.y
                  const temp = rotatePoint(x,y,angle*rotationEffect,matterPosition)
                  x = temp.x
                  y = temp.y
                  newPath.push([x,y])
                }
                addToRenderStack({mode:"fill",stage:5,color:color,steps:newPath})
                if (outline) {
                  const color = (outline.color) ? outline.color : [0,0,0]
                  if (color.length < 4) { color[3] = 1 }
                  addToRenderStack({mode:"outline",stage:5,color:color,steps:newPath,width:(outline.width || 0.05)*scale})
                }
              }
            }
          }
        } 
      } 
    }

    //render wireframes
    if (options.renderWireframes || options.debugMode) {
      let body, part, i, j, k
      let newPath = []
      ctx.beginPath()
      // render all bodies
      for (i = 0; i < matterBodies.length; i++) {
        body = matterBodies[i]
        if (!body.render.visible) continue;

        // handle compound parts
        for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
          part = body.parts[k];
          newPath.push([part.vertices[0].x, part.vertices[0].y,true])
          ctx.moveTo(part.vertices[0].x, part.vertices[0].y)
          for (j = 1; j < part.vertices.length; j++) {
            if (!part.vertices[j - 1].isInternals) {
              newPath.push([part.vertices[j].x, part.vertices[j].y])
              ctx.lineTo(part.vertices[j].x, part.vertices[j].y)
            } else {
              newPath.push([part.vertices[j].x, part.vertices[j].y,true])
              ctx.moveTo(part.vertices[j].x, part.vertices[j].y)
            }
            if (part.vertices[j].isInternal) {
              newPath.push([part.vertices[(j + 1) % part.vertices.length].x, part.vertices[(j + 1) % part.vertices.length].y,true])
              ctx.moveTo(part.vertices[(j + 1) % part.vertices.length].x, part.vertices[(j + 1) % part.vertices.length].y)
            }
          }
          newPath.push([part.vertices[0].x, part.vertices[0].y])
          ctx.lineTo(part.vertices[0].x, part.vertices[0].y)
        }
      }
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgb(0, 150, 255)`
      ctx.stroke()
      if (newPath.length > 0) {
        addToRenderStack({mode:"outline",stage:5,color:[0,150,255],steps:newPath,width:1})
      }
    }

    //render bounding boxes 
    if (options.renderBounds || options.debugMode) {
      for (let bodyIndex in matterBodies) {
        const bounds = matterBodies[bodyIndex].bounds
        let newPath = []
        newPath.push([bounds.min.x,bounds.max.y])
        newPath.push([bounds.max.x,bounds.max.y])
        newPath.push([bounds.max.x,bounds.min.y])
        newPath.push([bounds.min.x,bounds.min.y])
        addToRenderStack({stage:5,steps:newPath,color:[200,0,0],width:2,mode:"outline"})
      }
    }
    return renderStack
  }

  //display it
  function display() {

    if (!cursed && ctx !== null) { ctx.restore() }

    //draw the outside
    (renderStack[0]) ? null : renderStack[0] = []
    renderStack[0].push({stage:0,mode:"fill",color:[15,15,15],steps:[
      [0,0,false,true],
      [canvasX,0,false,true],
      [canvasX,canvasY,false,true],
      [0,canvasY,false,true]
    ]})
    //clip it to keep other stuff from going out
    renderStack[0].push({stage:0,mode:"clip",steps:[
      [0,0],
      [1000,0],
      [1000,1000],
      [0,1000]
    ]})
    //and draw the background
    renderStack[0].push({stage:0,mode:"fill",color:[30,30,30],steps:[
      [0,0],
      [1000,0],
      [1000,1000],
      [0,1000]
    ]})
    //sort the stack
    let list = Object.keys(renderStack)
    const len = list.length
    for (let i = 0; i < len; i++) {
      for (let j = 0; j < len - 1 - i; j++) {
        if (list[j] > list[j + 1]) {
          const temp = list[j]
          list[j] = list[j + 1] + 0
          list[j + 1] = temp + 0
        }
      }
    } 

    //render the stack
    for (let key in list) {
      const subStack = renderStack[list[key]]
      const scale = {x:screenX/1000,y:screenY/1000}
      for (let index in subStack) {
        const item = subStack[index]
        let color = item.color
        if (color && color.length < 4) { color[3] = 1 }
        if (item.mode == "fill") {
          ctx.fillStyle   = `rgb(${color[0]},${color[1]},${color[2]},${color[3]})`
        } else if (item.mode == "outline") {
          ctx.strokeStyle = `rgb(${color[0]},${color[1]},${color[2]},${color[3]})`
        }
        ctx.beginPath()
        for (let pointIndex = 0; pointIndex < item.steps.length + 1; pointIndex++) {
          const point = item.steps[pointIndex % item.steps.length]
          let x = point[0]
          let y = point[1]
          if (!point[3]) {
          if (cursed) {
            const radians = (Math.PI / 360) * ((Math.cos(time/1000)*360) + (Math.sin(time/2500)*360))
            const center = {
              x: 500+(Math.abs(Math.sin(time/10000))**1000*(Math.sin(time/10000)>0?1:-1))*1000,
              y: 500+(Math.abs(Math.cos(time/10000))**1000*(Math.cos(time/10000)>0?1:-1))*1000
            }
            const translatedX = x - center.x
            const translatedY = y - center.y
            const rotatedX = translatedX * Math.cos(radians) - translatedY * Math.sin(radians)
            const rotatedY = translatedX * Math.sin(radians) + translatedY * Math.cos(radians)
            x = rotatedX + center.x
            y = rotatedY + center.y
            x += Math.random() < .01 ? (Math.random() < .5 ? 50 : -50) : 0
            y += Math.random() < .01 ? (Math.random() < .5 ? 50 : -50) : 0
            if (color) {
              color[0] = 255 - color[0]
              color[1] = 255 - color[1]
              color[2] = 255 - color[2]
              color[3] = 1 - (Math.abs(Math.sin(time/(Math.cos(time/10000)**2*10000)))) + .1
            }
            if (item.mode == "fill") {
              ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]},${color[3]})`
            } else if (item.mode == "outline") {
              ctx.strokeStyle = `rgb(${color[0]},${color[1]},${color[2]},${color[3]})`
            }    
          }
          x = x * scale.x + canvasOffsetX
          y = y * scale.y + canvasOffsetY
          }
          if (point[2]) {
            ctx.moveTo(x,y)
          } else {
            ctx.lineTo(x,y)
          }
        }
        if (item.mode == "fill") {
          ctx.fill()
        } else if (item.mode == "outline") {
          ctx.lineWidth = item.width * ((scale.x+scale.y)/2)
          ctx.stroke()
        } else if (item.mode == "clip" && !cursed) {
          ctx.clip()
        }
      }
    }
  }

  setup()
  display()
}

//resets things like the renderStack every frame
function reset() {
  //reset the renderStack so as not to draw duplacates 
  renderStack = {}

  //the other half of the scroll math is elsewhere
  let scroll = playerInput.mouse.scroll
  let now = Date.now()  
  let timeDifferance = scroll.last.time - now
  scroll.speed = Math.round(scroll.last.scroll / timeDifferance)
  if (scroll.speed == -0) { scroll.speed = 0 }
}

//put it in a function to keep it organized
function getPlayerInputs() {

//run whenever any key is pressed
window.addEventListener("keydown", (event) => {
  //only allow some keys to take care of problems with combo keys
  let allowed = false
  let keys = playerInput.keys
  let allowedKeys = keys.allowed
  for (const index in allowedKeys) {
    if (allowedKeys[index] == (event.key.toLowerCase())) {
      allowed = true
      break
    }
  }
  if (allowed) {
    let isDupe = false
    for (const key in keys.current) {
      if (key == event.key.toLowerCase()) {
        isDupe = true
        break
      }
    }
    //add the key to current along with the time when the key is first pressed
    if (!isDupe) {
      keys.current[event.key.toLowerCase()] = time
    }
    //check if this key being pressed is the last thing in the log
    if (keys.log.length == 0 || !(
      keys.log[keys.log.length-1].key == event.key.toLowerCase() && 
      keys.log[keys.log.length-1].mode == "down")) {
        //add the key to the log along with the time for use is precice inputs
        keys.log.push({key:event.key.toLowerCase(),time:time,mode:"down"})
      }
  }
})

//run everytime a key is relesed
window.addEventListener("keyup", (event) => {
  //remove it from current
  delete playerInput.keys.current[event.key.toLowerCase()]
  //add it to the log
  playerInput.keys.log.push({key:event.key.toLowerCase(),time:time,mode:"up"})
})

//prevent users from rightclicking open the menu
window.addEventListener('contextmenu', function(event) {
  event.preventDefault()
})

//run whenever a mouse button is pressed
window.addEventListener("mousedown", (event) => {
  //set button to the name of the button pressed
  const button = playerInput.mouse.buttons.names[event.button]
  //add button to current
  playerInput.mouse.buttons.current[button] = time
  //add button to the log
  playerInput.mouse.buttons.log.push({button:button,time:time,mode:"down"})
})

//run whenever a mouse button is relesed
window.addEventListener("mouseup", (event) => {
  //set button to the name of the button relesed
  const button = playerInput.mouse.buttons.names[event.button]
  //remove button from current
  delete playerInput.mouse.buttons.current[button]
  //add to the log
  playerInput.mouse.buttons.log.push({button:button,time:time,mode:"up"})
})

//run whevener the mouse is scrolled
window.addEventListener("mousewheel", (event) => {
  let scroll = playerInput.mouse.scroll
  //store the direction
  scroll.last.scroll = event.wheelDelta
  //and the time
  scroll.last.time = Date.now()
  //the other half is in the reset function
  //add it to the log
  scroll.log.push({scroll:event.wheelDelta,time:time})
})

//run whenever the mouse is moved
window.addEventListener("mousemove", (event) => {
  let position = playerInput.mouse.position
  //set current
  position.current.x = event.x
  position.current.y = event.y
  position.current.time = time
  //and add to the log
  position.log.push({x:event.x,y:event.y,time:time})
})
}
getPlayerInputs()

let detectors = []

function collisionDetection() {
  let bodies = Composite.allBodies(engine.world)
  
  let testDetector = Detector.create()
  Detector.setBodies(testDetector, bodies)
  detectors[0] = testDetector
  
  for (let detectorId in detectors) {
    let collisions = Detector.collisions(detectors[detectorId])
    for (let collisionId in collisions) {
      let collision = collisions[collisionId]
      let bodyA = collision.bodyA
      let bodyB = collision.bodyB
      while (!matterLinks[bodyA.id]) {
        bodyA = bodyA.parent
      }
      while (!matterLinks[bodyB.id]) {
        bodyB = bodyB.parent
      }
      collision = [bodyA.id, bodyB.id]


      console.log(collision)
    }
  }
  // let bodies = Composite.allBodies(engine.world)
  // let detector = Detector.create()
  // Detector.setBodies(detector, bodies)
  // let collisions = Detector.collisions(detector)
  // let ids = {}
  // let id, body
  // for (let collisionId in collisions) {
  //   let collision = collisions[collisionId]
  //   body = collision.bodyA
  //   id = body.id
  //   while (!matterLinks[id]) {
  //     body = body.parent
  //     id = body.id
  //   }
  //   ids[id] = body
  //   body = collision.bodyB
  //   id = body.id
  //   while (!matterLinks[id]) {
  //     body = body.parent
  //     id = body.id
  //   }
  //   ids[id] = body
  // }
  // for (let id in ids) {
  //   let block = matterLinks[id]
  //   if (!block) {console.log(ids[id])}
  //   if (block && block.coverArt) {
  //     let coverArt = block.coverArt
  //     for (let layerId in coverArt.layers) {
  //       let layer = coverArt.layers[layerId]
  //       layer.color[0] = Math.max(layer.color[0]-5,0)
  //       layer.color[1] = Math.max(layer.color[1]-5,0)
  //       layer.color[2] = Math.max(layer.color[2]-5,0)
  //       if (!layer.outline) {layer.outline={width:0,color:[0,0,0]}}
  //       layer.outline.color[3] = .05
  //       layer.outline.color[0] = Math.min(layer.outline.color[0]+5,255)
  //       layer.outline.width = Math.min(layer.outline.width+.01,.5)
  //     }
  //   }
  // }
}

//the main loop
function update(inputTime) {
  const deltaTime = inputTime - lastTime
  lastTime = inputTime
  time = inputTime
  
  reset() //resets anything for the next loop
  Runner.tick(runner, engine) //tick the Matter engine
  render({debugMode:false}) //render everthing
  collisionDetection()
  if (updateindex % timePerSlide == 0) {
    const keys = Object.keys(levels);
    const randomIndex = Math.floor(Math.random() * keys.length);
    const randomKey = keys[randomIndex];
    initializeLevel(levels[randomKey])
    //initializeLevel(levels.level4)
  }
  //start the next loop
  updateindex++
  requestAnimationFrame(update)
}

// all the blocks for building levels with, file structure is:
// -name
// --coverart
// ---layers
// ----{color,steps,[rotationEffect],[outline{color,[width]}]}
// ---[files]
// ---[functions]
// ----onRender()
// ----inputs()
// ---physics
// ----shape
let blocks = {
  basic: {
    coverArt: {
      layers: [
        {
          color: [100,100,100,0.5],
          steps: [[0,0],[0,1],[1,1],[1,0]],
          outline: {
            color: [50,50,50],
            width: 0.1
          }
        }
      ]
    },
    files: {
      file: "Im a file"
    },
    functions: {
      onRender: function(input) {
      },
      inputs: function(input, self) {
        if (input) {
          if (input.shape) {self.coverArt.layers[0].steps = input.shape
          self.physics.shape = input.shape}
          if (input.color) {
            self.coverArt.layers[0].color = input.color
          }
          if (input.outline) {self.coverArt.layers[0].outline = input.outline}
          if (input.angle) {self.physics.angle = input.angle}
        }
      }
    },
    physics: {
      shape: [[0,0],[0,1],[1,1],[1,0]]
    }
  },
  clover: {
    coverArt: {
      layers: [
        {
          color: [100,100,0],
          steps: [[0,0.166],[0.166,0],[0.333,0],[0.5,0.333],[0.666,0],[0.666,0],[0.833,0],[1,0.166],[1,0.333],[0.666,0.5],[1,0.666],[1,0.833],[0.833,1],[0.666,1],[0.5,0.666],[0.333,1],[0.166,1],[0,0.833],[0,0.666],[0.333,0.5],[0,0.333]]        },
        {
          color: [0,100,100,0.5],
          steps: [[0.166,0.166],[0.333,0.166],[0.5,0.333],[0.666,0.166],[0.833,0.166],[0.833,0.333],[0.666,0.5],[0.833,0.666],[0.833,0.833],[0.666,0.833],[0.5,0.666],[0.333,0.833],[0.166,0.833],[0.166,0.666],[0.333,0.5],[0.166,0.333]]        },
        {
          color: [0,150,0],
          steps:[[0.5,0.333],[0.333,0.5],[0.5,0.666],[0.666,0.5]]
        }
      ]
    },
    physics: {
      collisions : {
        selfTags: ["clover","solid"],
        colideTags: ["solid"]
      },
      functions: {
        collision: function(collision) {
          
        }
      },
      shape: [[0,0.166],[0.166,0],[0.333,0],[0.5,0.333],[0.666,0],[0.666,0],[0.833,0],[1,0.166],[1,0.333],[0.666,0.5],[1,0.666],[1,0.833],[0.833,1],[0.666,1],[0.5,0.666],[0.333,1],[0.166,1],[0,0.833],[0,0.666],[0.333,0.5],[0,0.333]]    }
  },
  ball: {
    coverArt: {
      layers: [
        {
          color: [200,200,200],
          steps: [[0.4,0],[0.6,0],[0.8,0.1],[0.9,0.2],[1,0.4],[1,0.6],[0.9,0.8],[0.8,0.9],[0.6,1],[0.4,1],[0.2,0.9],[0.1,0.8],[0,0.6],[0,0.4],[0.1,0.2],[0.2,0.1]]
        },
        {
          rotationEffect: 0,
          color: [0,0,0],
          steps: [[0.3,0.4],[0.2,0.3],[0.3,0.1],[0.4,0.3],[0.6,0.3],[0.7,0.1],[0.8,0.3],[0.7,0.4],[0.3,0.4],[0.3,0.5],[0.2,0.6],[0.2,0.7],[0.3,0.8],[0.4,0.8],[0.5,0.9],[0.6,0.8],[0.7,0.8],[0.8,0.7],[0.8,0.6],[0.7,0.5],[0.3,0.5]]
        },
        {
          rotationEffect: 8,
          color: [255,0,0,.2],
          steps: [[0,-0.25],[-0.25,-0.5],[0,-0.5],[0,-0.25],[0.5,-0.25],[0.25,-0.5],[0.5,-0.75],[0.75,-0.5],[0.5,-0.25],[1,-0.25],[1,-0.5],[1.25,-0.5],[1,-0.25],[1.25,0],[1.5,-0.25],[1.5,0],[1.25,0],[1.25,0.5],[1.5,0.25],[1.75,0.5],[1.5,0.75],[1.25,0.5],[1.25,1],[1.5,1.25],[1.5,1],[1.25,1],[1,1.25],[1.25,1.5],[1,1.5],[1,1.25],[0.5,1.25],[0.75,1.5],[0.5,1.75],[0.25,1.5],[0.5,1.25],[0,1.25],[-0.25,1.5],[0,1.5],[0,1.25],[-0.25,1],[-0.5,1.25],[-0.5,1],[-0.25,1],[-0.25,0.5],[-0.5,0.75],[-0.75,0.5],[-0.5,0.25],[-0.25,0.5],[-0.25,0],[-0.5,-0.25],[-0.5,0],[-0.25,0],[-0.25,1],[0,1.25],[1,1.25],[1.25,1],[1.25,0],[1,-0.25]]         
        },
        {
          rotationEffect: 4,
          color: [0,255,0,.2],
          steps: [[0,-0.25],[-0.25,-0.5],[0,-0.5],[0,-0.25],[0.5,-0.25],[0.25,-0.5],[0.5,-0.75],[0.75,-0.5],[0.5,-0.25],[1,-0.25],[1,-0.5],[1.25,-0.5],[1,-0.25],[1.25,0],[1.5,-0.25],[1.5,0],[1.25,0],[1.25,0.5],[1.5,0.25],[1.75,0.5],[1.5,0.75],[1.25,0.5],[1.25,1],[1.5,1.25],[1.5,1],[1.25,1],[1,1.25],[1.25,1.5],[1,1.5],[1,1.25],[0.5,1.25],[0.75,1.5],[0.5,1.75],[0.25,1.5],[0.5,1.25],[0,1.25],[-0.25,1.5],[0,1.5],[0,1.25],[-0.25,1],[-0.5,1.25],[-0.5,1],[-0.25,1],[-0.25,0.5],[-0.5,0.75],[-0.75,0.5],[-0.5,0.25],[-0.25,0.5],[-0.25,0],[-0.5,-0.25],[-0.5,0],[-0.25,0],[-0.25,1],[0,1.25],[1,1.25],[1.25,1],[1.25,0],[1,-0.25]]         
        },
        {
          rotationEffect: 2,
          color: [0,0,255,.2],
          steps: [[0,-0.25],[-0.25,-0.5],[0,-0.5],[0,-0.25],[0.5,-0.25],[0.25,-0.5],[0.5,-0.75],[0.75,-0.5],[0.5,-0.25],[1,-0.25],[1,-0.5],[1.25,-0.5],[1,-0.25],[1.25,0],[1.5,-0.25],[1.5,0],[1.25,0],[1.25,0.5],[1.5,0.25],[1.75,0.5],[1.5,0.75],[1.25,0.5],[1.25,1],[1.5,1.25],[1.5,1],[1.25,1],[1,1.25],[1.25,1.5],[1,1.5],[1,1.25],[0.5,1.25],[0.75,1.5],[0.5,1.75],[0.25,1.5],[0.5,1.25],[0,1.25],[-0.25,1.5],[0,1.5],[0,1.25],[-0.25,1],[-0.5,1.25],[-0.5,1],[-0.25,1],[-0.25,0.5],[-0.5,0.75],[-0.75,0.5],[-0.5,0.25],[-0.25,0.5],[-0.25,0],[-0.5,-0.25],[-0.5,0],[-0.25,0],[-0.25,1],[0,1.25],[1,1.25],[1.25,1],[1.25,0],[1,-0.25]]         
        },
      ]
    },
    physics: {
      shape: [[0.4,0],[0.6,0],[0.8,0.1],[0.9,0.2],[1,0.4],[1,0.6],[0.9,0.8],[0.8,0.9],[0.6,1],[0.4,1],[0.2,0.9],[0.1,0.8],[0,0.6],[0,0.4],[0.1,0.2],[0.2,0.1]]
    }
  },
  test: {
    coverArt: {
      layers: [
        {
          color: [0,100,100],
          steps: [[0,0],[0,0],[0.333,0],[0.5,0.5],[0.666,0],[1,0],[1,1],[0,1]]
        }
      ]
    },
    physics: {
      shape: [[0,0],[0,0],[0.333,0],[0.5,0.5],[0.666,0],[1,0],[1,1],[0,1]]

    }
  }
}

// all the levels, file structure is:
// -levelName {}
// --key []
// --layout []
// ---{x,y,key,scale,[options],[inputs]}
// --[setupFunc] {}
// --[files]
let levels = {
  level1: {
    key: [
      blocks.clover,
      blocks.basic,
      blocks.ball
    ],
    layout: [
      {x: 500, y: 100, key: 2, scale: 50},
      {x: 200, y: 0, key: 0, scale: 200},
      {x: 225, y: 350, key: 0, scale: 25 , options: {frictionAir: .1}},
      {x: 250, y: 350, key: 0, scale: 25 , options: {frictionAir: .05}},
      {x: 275, y: 350, key: 0, scale: 25 , options: {frictionAir: .01}},
      {x: 400, y: 600, key: 0, scale: 100, inputs: {}},
      {x: 300, y: 200, key: 1, scale: 100, inputs: {shape:[[0,0],[0,1],[1,1],[1,0]]}},
      {x: 500, y: 200, key: 1, scale: 100, inputs: {shape:[[.5,-.5],[1,.5],[.5,1],[0,.5]], color:[0,255,255,0.5]}, options: {frictionAir: 0}},
      {x: 100, y: 950, key: 1, scale: 100, inputs: {shape:[[0,0],[0,1],[8,1],[8,0]]}, options: {isStatic: true}}
    ],
    setupFunc: function(self) {
      for (let i = 0; i < 10; i++) {
        self.layout[9+i] = 
        {
          x: Math.floor(Math.random()*1000),
          y: Math.floor(Math.random()*900), 
          key: 1,
          scale: 25, 
          options: {isStatic: true}, 
          inputs: {angle: Math.random()*360}
        }
        for (let i = 0; i < 25; i++) {
          self.layout[19+i] = 
          {
            x: Math.floor(Math.random()*1000),
            y: -Math.floor(Math.random()*2000), 
            key: 2,
            scale: 25, 
            options: {isStatic: false},
          }
        }
      }
    },
    files: {
    }
  },
  level2: {
    key: [
      blocks.clover,
      blocks.basic
    ],
    layout: [
      {x: 500, y: 300, scale: 75, key: 1},
      {x: 500, y: 500, scale: 75, key: 1},
      {x: 500, y: 400, scale: 100, key: 1},
      {x: 400, y: 400, scale: 100, key: 1, inputs: {shape: [[-1,0],[-1,2],[1,2],[1,0]]}},
      {x: 600, y: 400, scale: 100, key: 1, inputs: {shape: [[0,0],[0,3],[2,3],[2,0]]}},
      {x: 100, y: 900, key: 1, scale: 100, inputs: {shape:[[0,0],[0,1],[8,1],[8,0]]}, options: {isStatic: true}}
    ],
    setupFunc: function(self) {
      for (let blockIndex in self.layout) {
        //self.layout[blockIndex].options = {isStatic: true}
      }
    }
  },
  level3: {
    key: [
      blocks.clover,
      blocks.basic
    ],
    layout: [
      {x: 150, y: 900, key: 1, scale: 100, inputs: {shape:[[0,0],[0,1],[8,1],[8,0]]}, options: {isStatic: true}}
    ],
    setupFunc: function(self) {
      for (let i = 0; i < 10; i++) {
        self.layout[1+i] = 
        {
          x: Math.floor(Math.random()*800+100),
          y: Math.floor(Math.random()*800), 
          key: 0,
          scale: (Math.floor(Math.random()*3)+1)*50, 
          inputs: {angle: Math.random()*360}
        }
      }
    }
  },
  level4: {
    key: [
      blocks.test,
      blocks.clover,
      blocks.basic
    ],
    layout: [
      {x:550,y:0,key:0,scale:100},
      {x:450,y:0,key:2,scale:100},
      {x:500,y:500,key:1,scale:500,options:{isStatic:true}}
    ]
  }
}

//all my plans
const todo = {
 "Add Matter.js" : "Done",
 "Add wireframes to render" : "Done",
 "Add a linking system for physics objects" : "Done",
 "Add cursed mode" : "Done",
 "Fix coverArt " : "Done",
 "Let canvas change size" : "Done",
 "Add key inputs" : "Done",
 "Add char inputs" : "Canceled",
 "Add mouse button inputs" : "Done",
 "Add mouse scroll input" : "Done",
 "Add mouse position input" : "Done",
 "Add a nice todo list with feedback" : "Done",
 "Add a log of how many times I have reloaded the program" : "Done",
 "Redo addPhysicsObject to take a block as input" : "Canceled",
 "Fix renders outline on physics objects so it scales correctly" : "Done",
 "Add collisions" : "In progress",
 "Add block tags (for collisions / ?)" : "Planned",
 "Add collision functions by block / level" : "Planned",
 "Switch to webgl" : "Planned",
 "Add moving veiw area (like when a character moves around in mario)" : "Planned",
 "Add a charater" : "Planned",
 "Add more characters" : "Planned",
 "Make Matter levels have any size" : "Planned",
 "Add sounds?" : "Planned",
 "Add saves" : "Planned",
 "Add a modular GUI (use a library?)" : "Planned",
 "Add level / block creator" : "Planned",
 "Add enemies?" : "Planned",
 "Add a server where people can upload/download their profiles/levels?" : "Planned",
}

//just a nice little function to remind me of the bits I've done, or have planned etc
function debugTodo() {
  let tasks = {}
  let ratio = {}
  let length = 0
  for (let task in todo) {
    const state = todo[task]
    if (!tasks[state]) { tasks[state] = [] ; ratio[state] = 0 }
    tasks[state].push(task)
    ratio[state]++
    length++
  }
  let message = "Tasks: ("+length+")\n"
  for (let state in tasks) {
    message+=("\n"+Math.round(ratio[state]/length*100)+"% ")
    message+=(state+": ")
    message+=("("+ratio[state]+")\n")
    for (let taskIndex in tasks[state]) {
      message+=(" * "+tasks[state][taskIndex]+"\n")
    }
  }
  let sessionVisitIndex = sessionStorage.getItem("sessionVisitIndex") || 0
  let totalVistIndex = localStorage.getItem("totalVistIndex") || 0
  sessionVisitIndex++
  totalVistIndex++
  sessionStorage.setItem("sessionVisitIndex",sessionVisitIndex)
  localStorage.setItem("totalVistIndex",totalVistIndex)
  message+=("\n\nYou have reloaded this page " + totalVistIndex + " times")
  message+=(" (" + sessionVisitIndex + " times this session)")
  console.debug(message)
}
debugTodo()

//update as fast as possible
requestAnimationFrame(update)

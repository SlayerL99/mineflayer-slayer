const mineflayer = require('mineflayer')
const inventoryViewer = require('mineflayer-web-inventory')
const armorManager = require("mineflayer-armor-manager");
const mineflayerDashboard = require("mineflayer-dashboard");
const collectBlock = require('mineflayer-collectblock').plugin
const AutoAuth = require('mineflayer-auto-auth')
const { pathfinder, Movements, GoalNear } = require('mineflayer-pathfinder'); // Import pathfinder

const bot = mineflayer.createBot({
  host: 'localhost', // minecraft server ip
  username: 'BjornVikingo', // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
  auth: 'offline', // for offline mode servers, you can set this to 'offline'
  // port: 25565,              // set if you need a port that isn't 25565
  version: '1.21.1',           // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
  // password: '12345678'      // set if you want to use password-based auth (may be unreliable). If specified, the `username` must be an email
  plugins: [AutoAuth],
  AutoAuth: 'bjorn'
})

let target = null

//LOGIN
/*
bot.once('spawn', () => {
  bot.chat('/login bjorn')
  mineflayerViewer(bot, { firstPerson: false, port: 3007 })
})
*/

//AUTH
bot.on('serverAuth', function() {
  // Here bot should be already authorized
});

//ARMOR MANAGER
inventoryViewer(bot)
bot.loadPlugin(armorManager);
bot.once("spawn", () => bot.armorManager.equipAll());

// AUTOEAT
let isEating = false;

async function consumeItem() {
  if (isEating) {
    console.log('Bot is already eating. Cannot consume another item.');
    return;
  }

  isEating = true; // Set the eating state to true
  try {
    await bot.consume();
    console.log('Bot is eating...');
    
    // Wait until the bot finishes eating
    bot.once('health', () => {
      isEating = false; // Reset the eating state when health updates
      console.log('Bot has finished eating.');
    });
  } catch (err) {
    console.error('Failed to consume item:', err);
    isEating = false; // Reset the eating state on error
  }
}

bot.on('chat', (username, message) => {
  if (username === bot.username) return; // Ignore messages from the bot

  console.log(`${username}: ${message}`);

  // Check for the eat command
  if (message === '!bjorn eat') {
    consumeItem();
  }
});

//LOG
bot.on('kicked', console.log)
bot.on('error', console.log)

//DEFEND
//DEFEND NEARBY
function startAttackingMobs() {
  setInterval(() => {
    const mobs = bot.entities;

    for (const entityId in mobs) {
      const entity = mobs[entityId];

      // Check if the entity is a hostile mob
      if (entity && entity.type === 'mob' && entity.mobType !== 'player' && isHostile(entity)) {
        const distance = bot.entity.position.distanceTo(entity.position);

        // If the mob is within 10 blocks, attack it
        if (distance < 10) {
          bot.chat(`Attacking ${entity.name} at a distance of ${distance} blocks!`);
          bot.pathfinder.goto(new mineflayer.pathfinder.goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 1))
            .then(() => {
              bot.attack(entity);
            })
            .catch(err => {
              console.error(`Failed to move to the mob: ${err}`);
            });
        }
      }
    }
  }, 1000); // Check every second
}

//DEFEND IS HOSTILE
function isHostile(entity) {
  const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'slime', 'ghast', 'blaze', 'phantom', 'pillager', 'ravager'];
  return hostileMobs.includes(entity.mobType);
}

//PATHFINDING

bot.loadPlugin(pathfinder);

bot.on('chat', (username, message) => {
  if (username === bot.username) return; // Ignore messages from the bot

  console.log(`${username}: ${message}`);

//PATHFINDING TO PLAYER
  if (message.startsWith('!bjorn player')) {
    const targetPlayer = message.split(' ')[2]; // Get the player's name from the command
    const playerEntity = bot.players[targetPlayer];

    if (playerEntity) {
      bot.chat(`Walking to ${targetPlayer}...`);
      const targetPosition = playerEntity.entity.position;
      const movements = new Movements(bot);
      bot.pathfinder.setMovements(movements);

      bot.pathfinder.goto(new mineflayer.pathfinder.goals.GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, 1)) // 1 block radius
        .then(() => {
          bot.chat(`Arrived at ${targetPlayer}'s location!`);
        })
        .catch(err => {
          bot.chat(`Failed to walk to ${targetPlayer}: ${err}`);
        });
    } else {
      bot.chat(`I can't see a player named ${targetPlayer}.`);
    }
  }
});

//PATHFINDING TO COORDINATE
bot.on('chat', (username, message) => {
  if (username === bot.username) return; // Ignore messages from the bot

  console.log(`${username}: ${message}`);

  // Handle the coordinates command
  if (message.startsWith('!bjorn coords')) {
    const args = message.split(' ').slice(2); // Get the coordinates from the command
    if (args.length !== 3) {
      bot.chat('Please provide x, y, and z coordinates.');
      return;
    }

    const x = parseFloat(args[0]);
    const y = parseFloat(args[1]);
    const z = parseFloat(args[2]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      bot.chat('Invalid coordinates. Please provide valid numbers.');
      return;
    }

    bot.chat(`Walking to coordinates (${x}, ${y}, ${z})...`);
    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    bot.pathfinder.goto(new GoalNear(x, y, z, 1)) // 1 block radius
      .then(() => {
        bot.chat(`Arrived at coordinates (${x}, ${y}, ${z})!`);
      })
      .catch(err => {
        bot.chat(`Failed to walk to coordinates: ${err}`);
      });
  }

  // Add other commands here...
});

//MINE BLOCK
bot.on('chat', (username, message) => {
  if (username === bot.username) return; // Ignore messages from the bot

  if (message.startsWith('mine ')) {
    const blockType = message.split(' ')[1];
    mineBlock(blockType);
  }
});

async function mineBlock(blockType) {
  const block = bot.findBlock({
    matching: (block) => block.name === blockType,
    maxDistance: 64,
  });

  if (!block) {
    bot.chat(`No ${blockType} blocks found nearby.`);
    return;
  }

  const movements = new Movements(bot);
  bot.pathfinder.setMovements(movements);

  bot.pathfinder.setGoal(new pathfinder.goals.GoalBlock(block.position.x, block.position.y, block.position.z));

  bot.pathfinder.on('goal_reached', async () => {
    bot.chat(`Reached ${blockType} block. Mining...`);
    await bot.dig(block);
    bot.chat(`Successfully mined the ${blockType} block.`);
  });
}

//MINE ORES TREES
bot.on('chat', (username, message) => {
  if (username === bot.username) return; // Ignore messages from the bot

  if (message.startsWith('mine ')) {
    const target = message.split(' ')[1];
    mineBlock(target);
  }
});

async function mineBlock(target) {
  let block;

  // Determine if the target is an ore or a tree
  if (isOre(target)) {
    block = bot.findBlock({
      matching: (b) => isOre(b.name),
      maxDistance: 64,
    });
  } else if (isTree(target)) {
    block = bot.findBlock({
      matching: (b) => isTree(b.name),
      maxDistance: 64,
    });
  } else {
    bot.chat(`I don't know how to mine ${target}.`);
    return;
  }

  if (!block) {
    bot.chat(`No ${target} blocks found nearby.`);
    return;
  }

  const movements = new Movements(bot);
  bot.pathfinder.setMovements(movements);

  bot.pathfinder.setGoal(new pathfinder.goals.GoalBlock(block.position.x, block.position.y, block.position.z));

  bot.pathfinder.on('goal_reached', async () => {
    bot.chat(`Reached ${target} block. Mining...`);
    await bot.dig(block);
    bot.chat(`Successfully mined the ${target} block.`);
  });
}

function isOre(blockName) {
  const ores = ['coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'lapis_ore', 'redstone_ore', 'emerald_ore', 'nether_quartz_ore'];
  return ores.includes(blockName);
}

function isTree(blockName) {
  const logs = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
  return logs.includes(blockName);
}

/*
  //COLLECT
bot.loadPlugin(collectBlock)

let mcData
bot.once('spawn', () => {
  mcData = require('minecraft-data')(bot.version)
})

//COLLECT MINER

bot.on('chat', async (username, message) => {
  const args = message.split(' ')
  if (args[0] !== 'collect') return

  const blockType = mcData.blocksByName[args[1]]
  if (!blockType) {
    bot.chat(`I don't know any blocks named ${args[1]}.`)
    return
  }

  const block = bot.findBlock({
    matching: blockType.id,
    maxDistance: 64
  })

  if (!block) {
    bot.chat("I don't see that block nearby.")
    return
  }

  const targets = bot.collectBlock.findFromVein(block)
  try {
    await bot.collectBlock.collect(targets)
    // All blocks have been collected.
    bot.chat('Done')
  } catch (err) {
    // An error occurred, report it.
    bot.chat(err.message)
    console.log(err)
  }
})
*/

//COLLECT STORAGE
/*
bot.once('spawn', () => {
  bot.collectBlock.chestLocations = bot.findBlocks({
    matching: mcData.blocksByName.chest.id,
    maxDistance: 16,
    count: 999999 // Get as many chests as we can
  })

  if (bot.collectBlock.chestLocations.length === 0) {
    bot.chat("I don't see any chests nearby.")
  } else {
    for (const chestPos of bot.collectBlock.chestLocations) {
      bot.chat(`I found a chest at ${chestPos}`)
    }
  }
})

// Wait for someone to say something
bot.on('chat', async (username, message) => {
  // If the player says something start starts with "collect"
  // Otherwise, do nothing
  const args = message.split(' ')
  if (args[0] !== 'collect') return

  // If the player specifies a number, collect that many. Otherwise, default to 1.
  let count = 1
  if (args.length === 3) count = parseInt(args[1])

  // If a number was given the item number is the 3rd arg, not the 2nd.
  let type = args[1]
  if (args.length === 3) type = args[2]

  // Get the id of that block type for this version of Minecraft.
  const blockType = mcData.blocksByName[type]
  if (!blockType) {
    bot.chat(`I don't know any blocks named ${type}.`)
    return
  }

  // Find all nearby blocks of that type, up to the given count, within 64 blocks.
  const blocks = bot.findBlocks({
    matching: blockType.id,
    maxDistance: 64,
    count: count
  })

  // Complain if we can't find any nearby blocks of that type.
  if (blocks.length === 0) {
    bot.chat("I don't see that block nearby.")
    return
  }

  // Convert the block position array into a block array to pass to collect block.
  const targets = []
  for (let i = 0; i < Math.min(blocks.length, count); i++) {
    targets.push(bot.blockAt(blocks[i]))
  }

  // Announce what we found.
  bot.chat(`Found ${targets.length} ${type}(s)`)

  // Tell the bot to collect all of the given blocks in the block list.
  try {
    await bot.collectBlock.collect(targets)
    // All blocks have been collected.
    bot.chat('Done')
  } catch (err) {
    // An error occurred, report it.
    bot.chat(err.message)
    console.log(err)
  }
})
*/

//DASHBOARD
//bot.loadPlugin(mineflayerDashboard);

//ERROR
bot.on('error', (err) => {
  console.error(`Bot encountered an error: ${err.message}`);
});

bot.on('end', () => {
  console.log('Bot has disconnected. Exiting...');
  process.exit();
});
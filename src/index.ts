'use strict';

import { Logger } from 'sitka'
import fetch from 'node-fetch'
import config from 'config'
import * as CSV from 'csv-string';
import { Client, GuildMember, IntentsBitField } from 'discord.js'

const logger = Logger.getLogger()
const intents = new IntentsBitField()
intents.add('GuildMembers')
const client = new Client({ intents })
client.on('ready', () => {
	logger.info('Connected to Discord')
  mainInterval()
})
client.login(process.env.TOKEN)

function mainInterval() {
  mainInterval0()
    .catch(reason => {
		  logger.error(reason)
	  })
    .finally(() => {
      setTimeout(mainInterval, 10000)
    })
}

async function mainInterval0(): Promise<void> {
	if (!client.isReady()) {
    logger.error('Client not ready')
    return
  }

	const spreadsheet = config.get<string>('spreadsheet')
	const column = config.get<number>('column')
	const rowOffset = config.get<number>('rowOffset')
	const guildId = config.get<string>('guildId')
	const roleId = config.get<string>('roleId')

  logger.info('Fetching', { spreadsheet, column, rowOffset, guildId, roleId })
	const response = await fetch(spreadsheet)
	const body = await response.text()
  logger.info({ body })
	const csv = CSV.parse(body)
  logger.info({ csv })
	const discords = new Set(csv.slice(rowOffset)
		.map(row => row[column])
		.map(s => s.trim().toLowerCase()))
  logger.info({ discords })

	const guild = await client.guilds.fetch(guildId)
	const role = await guild.roles.fetch(roleId)
	if (role === null) {
		logger.error(`No role with ID ${roleId} in ${guildId}`)
		return
	}

	const membersFetch = await guild.members.fetch()
  logger.info('Fetched members')
	const memberMap = new Map<string, GuildMember>()
	Array.from(membersFetch.values()).forEach(m => {
		memberMap.set(m.user.tag.toLowerCase(), m)
	})
  logger.info({ 
    discords: Array.from(memberMap.keys()).sort() }
  )

	const promises = Array.from(discords).map(async (discord) => {
    logger.info({ discord })
		const member = memberMap.get(discord)
		if (member === undefined) {
			logger.warn(`Could not find member with discord name ${discord}`)
			return
		}
		if (member.roles.cache.has(roleId)) {
			return
		}
		await member.roles.add(role)
		logger.info(`Added submitted role to ${member.user.username}`)
	})
  await Promise.all(promises)
}
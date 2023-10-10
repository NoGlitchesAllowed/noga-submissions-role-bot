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

const notFound = new Set<string>()
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
	logger.debug('Beginning fetch', { spreadsheet, column, rowOffset, guildId, roleId })

	const response = await fetch(spreadsheet)
	const body = await response.text()
	const csv = CSV.parse(body)
	const discords = new Set(csv.slice(rowOffset)
		.map(row => row[column])
		.map(s => s.trim().toLowerCase()))

	const guild = await client.guilds.fetch(guildId)
	const role = await guild.roles.fetch(roleId)
	if (role === null) {
		logger.error(`No role with ID ${roleId} in ${guildId}`)
		return
	}

	const membersFetch = await guild.members.fetch()
	const memberMap = new Map<string, GuildMember>()
	Array.from(membersFetch.values()).forEach(m => {
		memberMap.set(m.user.tag.toLowerCase(), m)
	})

	const promises = Array.from(discords)
		.map(discord => {
			const member = memberMap.get(discord)
			if (member === undefined) {
				if (!notFound.has(discord)) {
					notFound.add(discord)
					logger.warn(`Could not find member with discord name ${discord}`)
				}
				return undefined
			}
			if (member.roles.cache.has(roleId)) {
				return undefined
			}
			return member
		})
		.flatMap(m => m !== undefined ? [m] : [])
		.map(async (member) => {
			await member.roles.add(role)
			logger.info(`Added submitted role to ${member.user.username}`)
		})
	await Promise.all(promises)
	logger.debug('Fetch has finished')
}
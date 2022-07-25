'use strict';

const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');
const { WebClient } = require('@slack/web-api');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const slackToken = config.slackToken;

const esClient = new Client({
    node: 'http://elasticsearch:9200'
});
const unsentSlacksIndex = 'unsent-slacks';

const slackClient = new WebClient(slackToken);
const slackChannel = '#alerts-and-notifications';
const slackGracePeriod = 5000;

// Attempts to send unsent Slacks. These failed to send even with the Slack client's 30-minute
// retry policy, so this should be rare.
(async () => {
    const result = await esClient.search({
        index: unsentSlacksIndex,
        query: {
            "match_all": {}
        }
    });
    for (const hit of result.hits.hits) {
        console.log(`Found unsent message ${hit._id}. Attempting to send`);
        const host = hit._source.host;
        const subject = hit._source.subject;
        const message = `<< This message failed to send in a timely manner >>\n\n${hit._source.message}`;
        const slackResult = await slackClient.chat.postMessage({
            channel: slackChannel,
            text: `${':hourglass_flowing_sand: '.repeat(4)}\n*${subject}*\n${host}\n\n${message}`
        });
        if (slackResult.ok) {
            console.log(`posted ${message.length} chars to Slack`);
        } else {
            throw new Error('non-OK return code from Slack');
        }

        await esClient.delete({
            index: unsentSlacksIndex,
            id: hit._id
        });

        // Don't hit Slack's rate limiting.
        await new Promise(r => setTimeout(r, slackGracePeriod));
    }
})();

// ELK free tier disallows actually notifying you of alerts via email, Slack, SMS, etc.
// But it does allow storing alerts in ES indexes, so we use that and poll.
[
    {
        esIndex: 'alerts-log-errors',
        getSubjectFunc: alert => {
            return alert._source.log.file.path;
        },
        getMessageFunc: alert => {
            return alert._source.message;
        }
    },
    {
        esIndex: 'alerts-disk-space',
        getSubjectFunc: alert => {
            return `High disk usage on ${alert._source.system.filesystem.mount_point}`;
        },
        getMessageFunc: alert => {
            return `${alert._source.system.filesystem.used.pct * 100}%`;
        }
    },
    {
        esIndex: 'alerts-memory-usage',
        getSubjectFunc: alert => {
            return `High memory usage`;
        },
        getMessageFunc: alert => {
            return `${alert._source.system.memory.actual.used.pct * 100}%`;
        }
    },
    {
        esIndex: 'alerts-systemd',
        getSubjectFunc: alert => {
            return 'Down systemd service';
        },
        getMessageFunc: alert => {
            return `${alert._source.system.service.name} is ${alert._source.system.service.state}`;
        }
    },
    {
        esIndex: 'alerts-docker-unhealthy-container',
        getSubjectFunc: alert => {
            return 'Unhealthy docker container';
        },
        getMessageFunc: alert => {
            return `${alert._source.container.name} is ${alert._source.docker.container.status}`;
        }
    }
].forEach(async alertType => {
    const result = await esClient.search({
        index: alertType.esIndex,
        query: {
            "match_all": {}
        }
    });
    for (const hit of result.hits.hits) {
        const id = hit._id;
        for (const alert of JSON.parse(hit._source.alertContexts)) {
            const host = alert._source.host;
            const subject = alertType.getSubjectFunc(alert);
            const message = alertType.getMessageFunc(alert);
            try {
                const slackResult = await slackClient.chat.postMessage({
                    channel: slackChannel,
                    text: `${':anger: '.repeat(4)}\n*${subject}*\n${host}\n\n${message}`
                });
                if (slackResult.ok) {
                    console.log(`posted ${message.length} chars to Slack`);
                } else {
                    throw new Error('non-OK return code from Slack');
                }

                // Don't hit Slack's rate limiting.
                await new Promise(r => setTimeout(r, slackGracePeriod));
            } catch (err) {
                console.error(err);
                await esClient.index({
                    index: unsentSlacksIndex,
                    body: {
                        host: host,
                        subject: subject,
                        message: message
                    }
                });
            }
        }

        await esClient.delete({
            index: alertType.esIndex,
            id: id
        });
    }
});

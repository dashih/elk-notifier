# elk-notifier
ELK (Elasticsearch, Logstash, Kibana) is a great tool with a highly functional free-tier. However, one limitation is in alert notifications; you cannot actually notify on alerts using email, Slack, SMS, etc. You can store alerts in an Elasticsearch index though, so I do that and poll it periodically to send to Slack (using Slack's free tier).

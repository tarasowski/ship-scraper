TABLE=producthunt-ship-ranking-prod

export:
	aws dynamodb scan --table-name $(TABLE) --query "Items[*].[hash.N,updateDate.S, img.S, link.S, subscriberCount.N, tagline.S, title.S]" --output json | jq -r '.[] | @csv' > dump.csv

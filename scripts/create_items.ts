import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { QBOClient } from '../lib/qbo'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)
const qbo = new QBOClient()

async function run() {
    const { data: tokens } = await supabase.from('qbo_tokens').select('*').single()
    if (!tokens) return

    const itemsToCreate = [
        { Name: 'Educational Therapy 125', UnitPrice: 125 },
        { Name: 'Educational Therapy 140', UnitPrice: 140 },
        { Name: 'Educational Therapy 150', UnitPrice: 150 },
        { Name: 'Educational Therapy 175', UnitPrice: 175 },
        { Name: 'Educational Therapy 195', UnitPrice: 195 },
        { Name: 'Educational Therapy 200', UnitPrice: 200 },
        { Name: 'Educational Therapy 215', UnitPrice: 215 },
        { Name: 'Educational Therapy 230', UnitPrice: 230 },
        { Name: 'Travel 12.50', UnitPrice: 12.50 },
        { Name: 'Travel 25', UnitPrice: 25 },
        { Name: 'Travel 50', UnitPrice: 50 },
    ]

    for (const item of itemsToCreate) {
        console.log(`Creating item: ${item.Name}`)
        const payload = {
            "TrackQtyOnHand": false,
            "Name": item.Name,
            "QtyOnHand": 0,
            "IncomeAccountRef": {
                "name": "Sales of Product Income",
                "value": "79"
            },
            "Type": "Service",
            "UnitPrice": item.UnitPrice
        }

        try {
            const res = await qbo.makeApiCall(tokens.access_token, tokens.realm_id, 'item', 'POST', payload)
            if (res.Item) {
                console.log(`✅ Created: ${res.Item.Name} (ID: ${res.Item.Id})`)
            } else {
                console.error(`❌ Failed:`, res)
            }
        } catch (e: any) {
            console.error(`Error creating ${item.Name}:`, e.message)
        }
    }
}
run()

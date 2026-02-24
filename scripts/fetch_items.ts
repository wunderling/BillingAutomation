import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { QBOClient } from '../lib/qbo'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)
const qbo = new QBOClient()

async function run() {
    console.log('Fetching tokens...')
    const { data: tokens, error } = await supabase.from('qbo_tokens').select('*').single()
    if (error || !tokens) {
        console.error('Error fetching tokens:', error)
        return
    }

    console.log('Fetching Item list from QBO Sandbox...')
    const query = `select * from Item`
    try {
        const result = await qbo.makeApiCall(tokens.access_token, tokens.realm_id, `query?query=${encodeURIComponent(query)}`)

        if (result.QueryResponse && result.QueryResponse.Item) {
            console.log(`Found ${result.QueryResponse.Item.length} items:`)
            result.QueryResponse.Item.forEach((item: any) => {
                console.log(`ID: ${item.Id} | Name: ${item.Name} | UnitPrice: ${item.UnitPrice}`)
            })
        } else {
            console.log('No items found or strange response:', JSON.stringify(result, null, 2))
        }
    } catch (e) {
        console.error('API Call Error:', e)
    }
}
run()

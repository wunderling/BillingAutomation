import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

async function run() {
    const { data, error } = await supabase.from('qbo_tokens').insert([
        {
            realm_id: '9341453314332270',
            access_token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwieC5vcmciOiJIMCJ9..DNScgZgcnSBIKrbn8bbYyA.BPs8vYSJeCwmOrJSX3L9N7EjyZFgHwwdS2g7cauLh6HMp4yXxtU4z21uvBw5zcr_WBl3xFswTmn_Woxfsk1476oN-dLU07RRUfQGvNFgw08BlHQP2nFIfsND-RetoONrjnJqUjlqdyZ9KEY3CozzsAPflJGo4btwcXm0lBlJ2XsPsOblKXkOWmjAPuwRVN4Yvlm8IPyHl9yt68EArl76EEj1gJL7u2n-3GuDO2FznmtrgF31NwZSUugfdpGhZexSmeiMPcdaIkQSCpq0FxTivvBHRv6mTeNYtOOKQtfyfldkz8AGxR8cJ8S7mB_NdjqFdHHGwkugGl15qEpL0359VytiN_qNXVwn6tOMLleaeY2A_m-L-scl3rR0f9XlrURmE5T8fTY-LW9Y05IFm4F3HsGJ6Jd-spHvQgL71tbRwTM2T5k6MguZHdEpMg9JDGSdxj9p3EKdWZXq8_QJ55QhaELCjcSx4FzIWD_EaYzvR30.i97kZvoFKdxawYciBhtdEw',
            refresh_token: 'RT1-96-H0-1780644920d23gqxgo4txlsr7bwhhw',
            // Access token expires in 1 hour
            access_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            // Refresh token expires in 101 days
            refresh_token_expires_at: new Date(Date.now() + 101 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
        }
    ])

    if (error) {
        console.error('Error inserting tokens:', error)
    } else {
        console.log('Successfully inserted QBO tokens!')
    }
}

run()

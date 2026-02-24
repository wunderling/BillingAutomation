import fetch from 'node-fetch'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function simulateWebhook() {
    const secret = process.env.INGEST_SECRET || 'wunderling_secret_123'

    const payload = {
        google_event_id: 'test_event_' + Date.now(),
        google_calendar_id: 'primary',
        title: 'Orly Bodner - Educational Therapy', // Should match Orly Bodner profile
        description: 'Meeting notes here',
        start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        end_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),   // 1 hour ago
        duration_minutes: '60',
        zap_student_name: 'Orly Bodner', // AI parsing
        service_category: 'Consultation',
        confidence: 'high'
    }

    console.log('Sending payload:', payload)

    try {
        const res = await fetch('http://localhost:3000/api/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-ingest-secret': secret
            },
            body: JSON.stringify(payload)
        })

        const text = await res.text()
        console.log('Response Status:', res.status)
        try {
            console.log('Response Body:', JSON.parse(text))
        } catch {
            console.log('Response Text:', text)
        }

    } catch (err) {
        console.error('Fetch error:', err)
    }
}

simulateWebhook()

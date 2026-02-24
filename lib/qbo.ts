import { createClient } from "./supabase/client";

// This file will handle QBO API interactions.
// For the 1-day MVP, we can keep the complex OAuth dance simple or use a library if available.
// However, the prompt suggests implementing OAuth2 flow.

export interface QBOToken {
    access_token: string;
    refresh_token: string;
    realm_id: string;
    access_token_expires_at: string;
}

export class QBOClient {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;
    private environment: 'sandbox' | 'production';

    constructor() {
        this.clientId = process.env.QBO_CLIENT_ID!;
        this.clientSecret = process.env.QBO_CLIENT_SECRET!;
        this.redirectUri = process.env.QBO_REDIRECT_URI!;
        this.environment = (process.env.QBO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    }

    public getAuthUri(): string {
        const scopes = 'com.intuit.quickbooks.accounting';
        const state = 'security_token'; // In prod use random string
        const baseUrl = 'https://appcenter.intuit.com/connect/oauth2';
        return `${baseUrl}?client_id=${this.clientId}&response_type=code&scope=${scopes}&redirect_uri=${this.redirectUri}&state=${state}`;
    }

    // Helper to base64 encode creds
    private getBasicAuthHeader(): string {
        return 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    }

    public async exchangeCodeForToken(code: string): Promise<any> {
        const url = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.redirectUri,
        });

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': this.getBasicAuthHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`ExampleCode Error: ${error}`);
        }

        return res.json();
    }

    public async refreshTokens(refreshToken: string): Promise<any> {
        const url = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': this.getBasicAuthHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`RefreshToken Error: ${error}`);
        }

        return res.json();
    }

    // Basic API Call wrapper
    public async makeApiCall(accessToken: string, realmId: string, endpoint: string, method: string = 'GET', body: any = null) {
        const baseUrl = this.environment === 'production'
            ? 'https://quickbooks.api.intuit.com'
            : 'https://sandbox-quickbooks.api.intuit.com';

        const url = `${baseUrl}/v3/company/${realmId}/${endpoint}`;

        const headers: any = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const res = await fetch(url, options);

        if (res.status === 401) {
            throw new Error('Unauthorized'); // Signal to refresh
        }

        const json = await res.json();
        return json;
    }

    public async findCustomer(accessToken: string, realmId: string, displayName: string) {
        // Query QBO
        // select * from Customer where DisplayName = 'displayName'
        // Fix for SQL injection: escape single quotes by doubling them per QBO spec
        const escapedName = displayName.replace(/'/g, "''");
        const query = `select * from Customer where DisplayName = '${escapedName}'`;
        const result = await this.makeApiCall(accessToken, realmId, `query?query=${encodeURIComponent(query)}`);
        return result.QueryResponse?.Customer?.[0] || null;
    }
}

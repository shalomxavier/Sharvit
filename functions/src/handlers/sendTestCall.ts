import type { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { allowCors } from '../utils/cors';

const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

export const sendTestCallHandler = async (req: Request, res: Response): Promise<void> => {
  if (allowCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!accountSid || !authToken || !fromPhone) {
      console.error('Twilio credentials not configured');
      res.status(500).json({ 
        error: 'Twilio not configured',
        message: 'Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables'
      });
      return;
    }

    const client = twilio(accountSid, authToken);
    const db = getFirestore();

    // Fetch all contacts from Firestore
    const contactsSnapshot = await db.collection('contacts').get();
    const contacts: { id: string; name: string; phone: string }[] = [];
    contactsSnapshot.forEach((doc) => {
      const data = doc.data();
      contacts.push({ 
        id: doc.id, 
        name: data.name, 
        phone: data.phone 
      });
    });

    if (contacts.length === 0) {
      res.status(400).json({ 
        error: 'No contacts found',
        message: 'Please add contacts before sending test calls'
      });
      return;
    }

    const results: { phone: string; success: boolean; error?: string }[] = [];

    // Make calls to each contact
    for (const contact of contacts) {
      try {
        // Create a simple TwiML that says a message
        const twiml = `
          <Response>
            <Say voice="alice">
                Hello ${contact.name}. This is a test call from your Crypto Trading Dashboard. 
                Your trading alerts are now active. Good luck with your trades.
            </Say>
          </Response>
        `;

        await client.calls.create({
          twiml: twiml,
          to: contact.phone,
          from: fromPhone
        });
        
        console.log(`Call initiated successfully to ${contact.name} (${contact.phone})`);
        results.push({ phone: contact.phone, success: true });
      } catch (error: any) {
        console.error(`Failed to call ${contact.phone}:`, error.message);
        results.push({ phone: contact.phone, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Calls initiated to ${successCount} contacts, ${failedCount} failed`,
      totalContacts: contacts.length,
      successCount,
      failedCount,
      results
    });

  } catch (error: any) {
    console.error('Send test call error:', error);
    res.status(500).json({ 
      error: 'Failed to send test calls',
      message: error.message 
    });
  }
};

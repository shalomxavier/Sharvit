import type { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { allowCors } from '../utils/cors';

const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

export const sendTestSmsHandler = async (req: Request, res: Response): Promise<void> => {
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
        message: 'Please add contacts before sending test SMS'
      });
      return;
    }

    const results: { phone: string; success: boolean; error?: string }[] = [];

    // Send SMS to each contact
    for (const contact of contacts) {
      try {
        await client.messages.create({
          body: `Test SMS from Crypto Trading Dashboard: This is a test message for ${contact.name}.`,
          from: fromPhone,
          to: contact.phone
        });
        console.log(`SMS sent successfully to ${contact.name} (${contact.phone})`);
        results.push({ phone: contact.phone, success: true });
      } catch (error: any) {
        console.error(`Failed to send SMS to ${contact.phone}:`, error.message);
        results.push({ phone: contact.phone, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `SMS sent to ${successCount} contacts, ${failedCount} failed`,
      totalContacts: contacts.length,
      successCount,
      failedCount,
      results
    });

  } catch (error: any) {
    console.error('Send test SMS error:', error);
    res.status(500).json({ 
      error: 'Failed to send test SMS',
      message: error.message 
    });
  }
};

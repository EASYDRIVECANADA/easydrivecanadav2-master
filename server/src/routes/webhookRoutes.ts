import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GHL Webhook endpoint - receives leads from GHL
router.post('/ghl/contact-created', async (req, res) => {
  try {
    console.log('GHL Webhook received:', JSON.stringify(req.body, null, 2));

    const { contact, locationId } = req.body;

    if (!contact) {
      return res.status(400).json({ error: 'No contact data provided' });
    }

    // Check if lead already exists by GHL contact ID
    const existingLead = await prisma.lead.findFirst({
      where: { ghlContactId: contact.id },
    });

    if (existingLead) {
      console.log('Lead already exists:', existingLead.id);
      return res.json({ message: 'Lead already exists', leadId: existingLead.id });
    }

    // Create lead from GHL data
    const lead = await prisma.lead.create({
      data: {
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        message: contact.notes || null,
        ghlContactId: contact.id,
        ghlSynced: true,
        // Map custom fields if they exist
        vehicleInterest: contact.customFields?.find((f: any) => f.key === 'vehicle_interest')?.value || null,
        employmentStatus: contact.customFields?.find((f: any) => f.key === 'employment_status')?.value || null,
        monthlyIncome: parseFloat(contact.customFields?.find((f: any) => f.key === 'monthly_income')?.value) || null,
        downPayment: parseFloat(contact.customFields?.find((f: any) => f.key === 'down_payment')?.value) || null,
        creditScore: contact.customFields?.find((f: any) => f.key === 'credit_score')?.value || null,
      },
    });

    console.log('Lead created from GHL webhook:', lead.id);
    res.json({ message: 'Lead created successfully', leadId: lead.id });
  } catch (error) {
    console.error('GHL webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// GHL Webhook endpoint - receives updates to contacts
router.post('/ghl/contact-updated', async (req, res) => {
  try {
    console.log('GHL Contact Update received:', JSON.stringify(req.body, null, 2));

    const { contact } = req.body;

    if (!contact?.id) {
      return res.status(400).json({ error: 'No contact ID provided' });
    }

    // Find existing lead
    const existingLead = await prisma.lead.findFirst({
      where: { ghlContactId: contact.id },
    });

    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Update lead from GHL data
    const updatedLead = await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        firstName: contact.firstName || existingLead.firstName,
        lastName: contact.lastName || existingLead.lastName,
        email: contact.email || existingLead.email,
        phone: contact.phone || existingLead.phone,
        message: contact.notes || existingLead.message,
      },
    });

    console.log('Lead updated from GHL webhook:', updatedLead.id);
    res.json({ message: 'Lead updated successfully', leadId: updatedLead.id });
  } catch (error) {
    console.error('GHL webhook update error:', error);
    res.status(500).json({ error: 'Failed to process webhook update' });
  }
});

// Test endpoint to verify webhook is working
router.get('/ghl/test', (req, res) => {
  res.json({ 
    message: 'GHL Webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
});

export default router;

import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GHL Webhook configuration (to be set in .env)
const GHL_INQUIRY_WEBHOOK_URL = process.env.GHL_INQUIRY_WEBHOOK_URL || '';
const GHL_FINANCING_WEBHOOK_URL = process.env.GHL_FINANCING_WEBHOOK_URL || '';

// GHL response type
interface GHLContactResponse {
  contact?: {
    id: string;
  };
}

// POST create lead (finance application)
router.post('/', async (req, res) => {
  try {
    const {
      name,
      firstName: firstNameDirect,
      lastName: lastNameDirect,
      email,
      phone,
      vehicleInterest,
      message,
      // Old financing fields
      employmentStatus,
      monthlyIncome: oldMonthlyIncome,
      downPayment,
      creditScore,
      // New Clutch-style fields
      dateOfBirth,
      annualIncome,
      monthlyRent,
      streetAddress,
      suiteUnit,
      city,
      province,
      postalCode,
      source,
    } = req.body;

    // Handle both name formats: combined "name" or separate firstName/lastName
    let firstName = firstNameDirect;
    let lastName = lastNameDirect;
    
    if (name && !firstName && !lastName) {
      const nameParts = name.trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Validate required fields
    if (!firstName || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }

    // Create lead in database
    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName: lastName || '',
        email,
        phone,
        vehicleInterest: vehicleInterest || null,
        message: message || null,
        // Old fields (for backward compatibility)
        employmentStatus: employmentStatus || null,
        monthlyIncome: oldMonthlyIncome ? parseFloat(String(oldMonthlyIncome)) : null,
        downPayment: downPayment ? parseFloat(String(downPayment)) : null,
        creditScore: creditScore || null,
      },
    });

    // Determine which webhook to use based on source
    const isFinancingApplication = source === 'financing_application' || 
                                   employmentStatus || oldMonthlyIncome || creditScore;
    const webhookUrl = isFinancingApplication ? GHL_FINANCING_WEBHOOK_URL : GHL_INQUIRY_WEBHOOK_URL;

    // Send to appropriate GoHighLevel webhook if configured
    if (webhookUrl) {
      try {
        // Pass the raw request data for Clutch fields
        const webhookData = {
          ...req.body,
          firstName,
          lastName,
        };
        const ghlResponse = await syncToGHL(webhookData, isFinancingApplication, webhookUrl);
        if (ghlResponse?.contact?.id) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              ghlContactId: ghlResponse.contact.id,
              ghlSynced: true,
            },
          });
        }
      } catch (ghlError) {
        console.error('GHL webhook error:', ghlError);
        // Don't fail the request if GHL webhook fails
      }
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
      },
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// GET all leads (admin)
router.get('/', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET single lead
router.get('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// DELETE lead
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Helper function to send lead to GoHighLevel via Webhook
async function syncToGHL(lead: any, isFinancing: boolean, webhookUrl: string): Promise<GHLContactResponse | null> {
  if (!webhookUrl) {
    console.log('GHL webhook not configured, skipping sync');
    return null;
  }

  try {
    // Build payload based on lead type
    let payload;
    
    if (isFinancing) {
      // Financing Application - Clutch-style pre-qualification fields
      payload = {
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        date_of_birth: lead.dateOfBirth || '',
        annual_income: lead.annualIncome?.toString() || '',
        monthly_rent: lead.monthlyRent?.toString() || '',
        street_address: lead.streetAddress || '',
        suite_unit: lead.suiteUnit || '',
        city: lead.city || '',
        province: lead.province || '',
        postal_code: lead.postalCode || '',
        vehicle_interest: lead.vehicleInterest || '',
        notes: lead.message || '',
        source: 'EasyDrive Canada - Financing Application',
        lead_id: lead.id,
        submitted_at: new Date().toISOString(),
      };
    } else {
      // Car Inquiry - simple 6 fields only
      payload = {
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        vehicle_interest: lead.vehicleInterest || '',
        notes: lead.message || '',
        source: 'EasyDrive Canada - Vehicle Inquiry',
        lead_id: lead.id,
        submitted_at: new Date().toISOString(),
      };
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(`GHL webhook failed: ${webhookResponse.status} - ${errorText}`);
      throw new Error(`GHL webhook failed: ${webhookResponse.status}`);
    }

    const responseData = await webhookResponse.json().catch(() => ({})) as { contactId?: string };
    console.log(`Lead sent to GHL ${isFinancing ? 'financing' : 'inquiry'} webhook successfully:`, lead.id);

    return { contact: { id: responseData?.contactId || 'webhook-sent' } };
  } catch (error) {
    console.error('GHL webhook error:', error);
    throw error;
  }
}

export default router;

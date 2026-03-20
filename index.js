// index.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['https://www.ikpace.com', 'https://ikpace.com', 'http://localhost:3000']
}));
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'iKPACE New Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// ===== ROOT ENDPOINT =====
app.get('/', (req, res) => {
  res.json({
    message: 'iKPACE Backend API',
    endpoints: {
      health: '/api/health',
      verifyPayment: '/api/verify-payment (POST)',
      paystackWebhook: '/api/paystack-webhook (POST)',
      users: '/api/users/:userId',
      enrollments: '/api/users/:userId/enrollments',
      payments: '/api/users/:userId/payments'
    }
  });
});

// ===== PAYMENT ENDPOINTS =====

// Verify payment with Paystack
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }
    
    console.log('Verifying payment:', reference);
    
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });
    
    const data = await response.json();
    
    if (data.status && data.data.status === 'success') {
      await supabase
        .from('payments')
        .update({ status: 'success', verified_at: new Date() })
        .eq('reference', reference);
      console.log('Payment verified and updated:', reference);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Paystack webhook
app.post('/api/paystack-webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log('Webhook received:', event);
    
    if (event === 'charge.success') {
      const { reference } = data;
      
      await supabase
        .from('payments')
        .update({ status: 'success', verified_at: new Date() })
        .eq('reference', reference);
      console.log('Webhook processed for:', reference);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== USER ENDPOINTS =====

// Get user profile
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { full_name, phone_number, location, occupation, website } = req.body;
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name, phone_number, location, occupation, website, updated_at: new Date() })
      .eq('id', userId)
      .select();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user enrollments
app.get('/api/users/:userId/enrollments', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('enrollments')
      .select(`*, courses (*)`)
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user payments
app.get('/api/users/:userId/payments', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 iKPACE New Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
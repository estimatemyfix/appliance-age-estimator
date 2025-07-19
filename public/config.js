// Configuration for Stripe payments
const CONFIG = {
    // Replace this with your actual Stripe publishable key
    // Get it from https://dashboard.stripe.com/test/apikeys
    STRIPE_PUBLISHABLE_KEY: 'pk_test_your_stripe_publishable_key_here',
    
    // Price for appliance analysis (in dollars)
    ANALYSIS_PRICE: 2.99,
    
    // Price in cents for Stripe (multiply by 100)
    ANALYSIS_PRICE_CENTS: 299
};

// Make config available globally
window.CONFIG = CONFIG; 
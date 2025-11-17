'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Check, X, ShoppingCart, CreditCard, Truck, Package, ArrowLeft } from 'lucide-react';

// Pricing configuration
const PRICING = {
  masterHive: 499,
  normalHive: 99,
  maxNormalPerMaster: 10
};

interface FormData {
  masterHives: number;
  normalHives: number;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  agreeToTerms: boolean;
}

interface FormErrors {
  [key: string]: string;
}

interface UserData {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    masterHives: 1,
    normalHives: 0,
    phone: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    agreeToTerms: false
  });
  
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
  try {
    const response = await fetch('/api/user/profile', {
      credentials: 'include',
      cache: 'no-store'
    });

    if (response.status === 401) {
      router.push('/login');
      return;
    }

    if (!response.ok) {
      setErrors({ auth: 'Failed to fetch user profile' });
      return;
    }

    const result = await response.json();

    if (!result.success || !result.user) {
      router.push('/login');
      return;
    }

    setUserData(result.user);
    
    // Pre-fill all available shipping info
    setFormData(prev => ({ 
      ...prev, 
      phone: result.user.phone || '',
      address: result.user.address || '',
      city: result.user.city || '',
      country: result.user.country || '',
      postalCode: result.user.postalCode || ''
    }));

  } catch (error) {
    console.error('Error fetching user data:', error);
    setErrors({ auth: 'Network error. Please try again.' });
  } finally {
    setLoading(false);
  }
};

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              (name === 'masterHives' || name === 'normalHives') 
                ? (parseInt(value) || 0) 
                : value
    }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};

    if (formData.masterHives < 1) {
      newErrors.masterHives = 'At least 1 master hive is required';
    }

    const maxAllowed = formData.masterHives * PRICING.maxNormalPerMaster;
    if (formData.normalHives > maxAllowed) {
      newErrors.normalHives = `Maximum ${maxAllowed} normal hives allowed for ${formData.masterHives} master hive(s)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }

    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.cardNumber.trim() || formData.cardNumber.replace(/\s/g, '').length < 13) {
      newErrors.cardNumber = 'Valid card number is required';
    }

    const expiryRegex = /^\d{2}\/\d{2}$/;
    if (!formData.cardExpiry.trim() || !expiryRegex.test(formData.cardExpiry)) {
      newErrors.cardExpiry = 'Valid expiry date is required (MM/YY)';
    }

    if (!formData.cardCvc.trim() || formData.cardCvc.length < 3) {
      newErrors.cardCvc = 'Valid CVC is required';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      default:
        isValid = true;
    }
    
    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) {
      return;
    }

    if (!userData) {
      setErrors({ submit: 'User data not found. Please refresh the page.' });
      return;
    }

    setProcessing(true);

    try {
      const purchaseResponse = await fetch('/api/user/new-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          masterHives: formData.masterHives,
          normalHives: formData.normalHives,
          totalAmount: calculateTotal(),
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          postalCode: formData.postalCode,
          fullName: `${userData.firstname} ${userData.lastname}`,
          cardLastFour: formData.cardNumber.replace(/\s/g, '').slice(-4)
        })
      });

      const result = await purchaseResponse.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/welcome?purchase=success');
        }, 3000);
      } else {
        setErrors({ submit: result.error || 'Purchase failed. Please try again.' });
        setProcessing(false);
      }
    } catch (error) {
      setErrors({ submit: 'An error occurred. Please try again.' });
      setProcessing(false);
      console.error('Purchase error:', error);
    }
  };

  const calculateTotal = (): number => {
    const masterCost = formData.masterHives * PRICING.masterHive;
    const normalCost = formData.normalHives * PRICING.normalHive;
    return masterCost + normalCost;
  };

  const formatCardNumber = (value: string): string => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts: string[] = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string): string => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setFormData(prev => ({ ...prev, cardNumber: formatted }));
    if (errors.cardNumber) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.cardNumber;
        return newErrors;
      });
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    setFormData(prev => ({ ...prev, cardExpiry: formatted }));
    if (errors.cardExpiry) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.cardExpiry;
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
          <p className="text-white text-xl font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Purchase Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your Smart Hive order has been submitted successfully.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Order Summary:</p>
            <p className="font-semibold text-gray-800">{formData.masterHives} Master Hive(s)</p>
            <p className="font-semibold text-gray-800">{formData.normalHives} Normal Hive(s)</p>
            <p className="text-lg font-bold text-green-600 mt-2">Total: ${calculateTotal()}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⏳ <strong>Pending Activation:</strong> Your purchase is awaiting admin approval. You'll receive access once approved.
            </p>
          </div>
          <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-xl mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Purchase Smart Hive</h1>
          <p className="text-gray-300">Add more hives to your monitoring system</p>
          {userData && (
            <p className="text-gray-400 text-sm mt-2">
              Welcome back, <strong className="text-white">{userData.firstname} {userData.lastname}</strong>
            </p>
          )}
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep >= step 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep > step ? <Check className="w-5 h-5" /> : step}
                  </div>
                  <p className={`text-xs mt-2 font-medium ${
                    currentStep >= step ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step === 1 && (
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Order
                      </span>
                    )}
                    {step === 2 && (
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        Shipping
                      </span>
                    )}
                    {step === 3 && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        Payment
                      </span>
                    )}
                  </p>
                </div>
                {step < 3 && (
                  <div className={`h-1 flex-1 mx-2 transition-all ${
                    currentStep > step ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {errors.auth && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{errors.auth}</p>
            </div>
          )}

          {/* Step 1: Order Configuration */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Package className="w-6 h-6 text-green-600" />
                Configure Your Order
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Master Hives *
                  </label>
                  <input
                    type="number"
                    name="masterHives"
                    min={1}
                    value={formData.masterHives}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {errors.masterHives && (
                    <p className="text-red-500 text-xs mt-1">{errors.masterHives}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">${PRICING.masterHive} each</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Normal Hives
                  </label>
                  <input
                    type="number"
                    name="normalHives"
                    min={0}
                    max={formData.masterHives * PRICING.maxNormalPerMaster}
                    value={formData.normalHives}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {errors.normalHives && (
                    <p className="text-red-500 text-xs mt-1">{errors.normalHives}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    ${PRICING.normalHive} each (Max: {formData.masterHives * PRICING.maxNormalPerMaster})
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Each master hive can monitor up to {PRICING.maxNormalPerMaster} normal hives.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4 text-lg">Order Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Master Hives</span>
                    <span className="font-semibold text-gray-800">{formData.masterHives} × ${PRICING.masterHive}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Normal Hives</span>
                    <span className="font-semibold text-gray-800">{formData.normalHives} × ${PRICING.normalHive}</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Total Amount</span>
                      <span className="text-3xl font-bold text-green-600">${calculateTotal()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Shipping Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Truck className="w-6 h-6 text-green-600" />
                Shipping Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="+971 50 123 4567"
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="123 Main Street, Apt 4B"
                />
                {errors.address && (
                  <p className="text-red-500 text-xs mt-1">{errors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Abu Dhabi"
                  />
                  {errors.city && (
                    <p className="text-red-500 text-xs mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country *
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="United Arab Emirates"
                  />
                  {errors.country && (
                    <p className="text-red-500 text-xs mt-1">{errors.country}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="12345"
                  />
                  {errors.postalCode && (
                    <p className="text-red-500 text-xs mt-1">{errors.postalCode}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3">Delivery Information</h4>
                <p className="text-sm text-gray-600 mb-2">
                  📦 Your order will be shipped to the address provided above.
                </p>
                <p className="text-sm text-gray-600">
                  ⏱️ Estimated delivery: 5-7 business days after order approval
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Payment Information */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-green-600" />
                Payment Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Number *
                </label>
                <input
                  type="text"
                  name="cardNumber"
                  value={formData.cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {errors.cardNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="text"
                    name="cardExpiry"
                    value={formData.cardExpiry}
                    onChange={handleExpiryChange}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {errors.cardExpiry && (
                    <p className="text-red-500 text-xs mt-1">{errors.cardExpiry}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CVC *
                  </label>
                  <input
                    type="text"
                    name="cardCvc"
                    value={formData.cardCvc}
                    onChange={handleInputChange}
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {errors.cardCvc && (
                    <p className="text-red-500 text-xs mt-1">{errors.cardCvc}</p>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4 text-lg">Final Order Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Account</span>
                    <span className="font-medium text-gray-800">{userData?.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Master Hives</span>
                    <span className="font-medium text-gray-800">{formData.masterHives} × ${PRICING.masterHive}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Normal Hives</span>
                    <span className="font-medium text-gray-800">{formData.normalHives} × ${PRICING.normalHive}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping to</span>
                    <span className="font-medium text-gray-800">{formData.city}, {formData.country}</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Total Amount</span>
                      <span className="text-3xl font-bold text-green-600">${calculateTotal()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <input
                  type="checkbox"
                  name="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onChange={handleInputChange}
                  className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label className="text-sm text-gray-700">
                  I agree to the <a href="/terms" className="text-blue-600 hover:underline">Terms and Conditions</a> and <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>. I understand that my purchase is subject to admin approval.
                </label>
              </div>
              {errors.agreeToTerms && (
                <p className="text-red-500 text-xs -mt-2">{errors.agreeToTerms}</p>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⏳ Pending Activation:</strong> Your purchase will bepending until approved by an admin. You'll receive access to your hives once the purchase is verified and approved.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t">
            {currentStep > 1 ? (
              <button
                onClick={handleBack}
                disabled={processing}
                className="flex items-center gap-2 px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div></div>
            )}

            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Continue
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={processing}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Complete Purchase
                    <Check className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Security Badge */}
        <div className="text-center mt-6">
          <p className="text-gray-300 text-sm flex items-center justify-center gap-2">
            🔒 Secure payment processing | Your information is encrypted and protected
          </p>
        </div>
      </div>
    </div>
  );
}
// viewflow-server/config/plans.js

const PLAN_LIMITS = {
  Starter: {
    name: 'Starter',
    maxProperties: 15,
    allowWhatsApp: false,
    allowKanban: true,
    allowPdfExport: false,
    allowCustomTemplates: false,
    allowFeedbackOffers: false
  },
  Growth: {
    name: 'Growth',
    maxProperties: Infinity,
    allowWhatsApp: true,
    allowKanban: true,
    allowPdfExport: true,
    allowCustomTemplates: true,
    allowFeedbackOffers: true
  },
  Enterprise: {
    name: 'Enterprise',
    maxProperties: Infinity,
    allowWhatsApp: true,
    allowKanban: true,
    allowPdfExport: true,
    allowCustomTemplates: true,
    allowFeedbackOffers: true,
    whitelabel: true
  }
};

const getPlanLimits = (plan = 'Starter') => {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.Starter;
};

module.exports = {
  PLAN_LIMITS,
  getPlanLimits
};

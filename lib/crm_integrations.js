import { queueContactSync } from './crm_recovery.js';
/**
 * =============================================================================
 * BOLTECH GROUP — INTEGRACIÓN DE CRM EMPRESARIAL: HUBSPOT & SALESFORCE
 * =============================================================================
 * Sincronización fiduciaria de prospectos B2B, cuentas clave y leads auditados.
 * Conectores:
 *   1. HubSpot API SDK (@hubspot/api-client)
 *   2. Salesforce API SDK (jsforce)
 * =============================================================================
 */

import hubspotPkg from '@hubspot/api-client';
import jsforce from 'jsforce';

const { Client: HubSpotClient } = hubspotPkg;
const { Connection: SalesforceConnection } = jsforce;

/**
 * Obtener cliente autenticado de HubSpot
 * @param {string} [customToken]
 */
export function getHubSpotClient(customToken = null) {
  const token = (customToken || process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY || '').trim();
  if (!token) {
    return null;
  }
  return new HubSpotClient({ accessToken: token });
}

/**
 * Obtener conexión autenticada de Salesforce
 * @param {Object} [customOptions]
 */
export function getSalesforceConnection(customOptions = {}) {
  const loginUrl = customOptions.loginUrl || process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
  const instanceUrl = customOptions.instanceUrl || process.env.SALESFORCE_INSTANCE_URL;
  const accessToken = customOptions.accessToken || process.env.SALESFORCE_ACCESS_TOKEN;

  if (accessToken && instanceUrl) {
    return new SalesforceConnection({
      instanceUrl,
      accessToken
    });
  }

  return new SalesforceConnection({
    loginUrl,
    version: '59.0'
  });
}

/**
 * Diagnóstico de estado de integración con CRMs
 */
export function getCRMStatus() {
  const hubspotToken = (process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY || '').trim();
  const sfToken = (process.env.SALESFORCE_ACCESS_TOKEN || '').trim();
  const sfUser = (process.env.SALESFORCE_USERNAME || '').trim();

  return {
    success: true,
    integrations: {
      hubspot: {
        configured: Boolean(hubspotToken && hubspotToken.length > 5),
        sdk: '@hubspot/api-client',
        status: (hubspotToken && hubspotToken.length > 5) ? 'CONFIGURED_UNVERIFIED' : 'PENDING_TOKEN'
      },
      salesforce: {
        configured: Boolean((sfToken && sfToken.length > 5) || (sfUser && sfUser.length > 3)),
        sdk: 'jsforce',
        loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
        status: (sfToken || sfUser) ? 'CONFIGURED_UNVERIFIED' : 'PENDING_CREDENTIALS'
      }
    }
  };
}

/**
 * Sincroniza un lead verificado a HubSpot y/o Salesforce
 * @param {Object} lead
 * @param {string} lead.email
 * @param {string} [lead.firstname]
 * @param {string} [lead.lastname]
 * @param {string} [lead.company]
 * @param {string} [lead.phone]
 * @param {string} [lead.source='BolTech Outbound Hunter']
 * @param {string} [lead.notes]
 */
export async function syncLeadToCRM(lead = {}) {
  if (!lead.email) {
    throw new Error('El correo electrónico es obligatorio para sincronizar con el CRM.');
  }

  const results = {
    email: lead.email,
    timestamp: new Date().toISOString(),
    hubspot: { synced: false },
    salesforce: { synced: false }
  };

  // HubSpot synchronization is persisted before a worker attempts delivery.
  results.hubspot = await queueContactSync(lead);

  // 2. Sincronización con Salesforce
  const sfAccessToken = process.env.SALESFORCE_ACCESS_TOKEN;
  const sfUsername = process.env.SALESFORCE_USERNAME;
  const sfPassword = process.env.SALESFORCE_PASSWORD;
  const sfSecurityToken = process.env.SALESFORCE_SECURITY_TOKEN || '';

  if (sfAccessToken || (sfUsername && sfPassword)) {
    try {
      const conn = getSalesforceConnection();
      if (!sfAccessToken && sfUsername && sfPassword) {
        await conn.login(sfUsername, sfPassword + sfSecurityToken);
      }

      const sfLead = {
        Email: lead.email,
        FirstName: lead.firstname || '',
        LastName: lead.lastname || lead.company || 'Contacto BolTech',
        Company: lead.company || 'Empresa Prospecto',
        Phone: lead.phone || '',
        LeadSource: lead.source || 'BolTech Outbound Hunter',
        Description: lead.notes || 'Lead calificado por agente soberano BolTech Group'
      };

      const sfRes = await conn.sobject('Lead').create(sfLead);
      results.salesforce = {
        synced: sfRes.success,
        leadId: sfRes.id,
        errors: sfRes.errors
      };
    } catch (err) {
      results.salesforce = {
        synced: false,
        error: err?.message || 'Error al comunicarse con Salesforce API'
      };
    }
  } else {
    results.salesforce = {
      synced: false,
      reason: 'Credenciales de Salesforce (SALESFORCE_ACCESS_TOKEN o USER/PASS) no configuradas.'
    };
  }

  return results;
}

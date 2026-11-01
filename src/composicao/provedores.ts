import type { AdaptadorArmazenamento } from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import { AdaptadorGoogleCloud } from '../adaptadores/armazenamento/AdaptadorGoogleCloud';
import { AdaptadorLocal } from '../adaptadores/armazenamento/AdaptadorLocal';
import { AdaptadorS3 } from '../adaptadores/armazenamento/AdaptadorS3';
import { ArmazenamentoExterno } from '../adaptadores/armazenamento/ArmazenamentoExterno';
import { GoogleCloudStorageSimulado } from '../adaptadores/armazenamento/GoogleCloudStorageSimulado';
import { S3Simulado } from '../adaptadores/armazenamento/S3Simulado';
import type { AdaptadorPagamento } from '../adaptadores/pagamento/AdaptadorPagamento';
import { AdaptadorPagSeguro } from '../adaptadores/pagamento/AdaptadorPagSeguro';
import { AdaptadorPayPal } from '../adaptadores/pagamento/AdaptadorPayPal';
import { AdaptadorStripe } from '../adaptadores/pagamento/AdaptadorStripe';
import { PagSeguroSimulado } from '../adaptadores/pagamento/PagSeguroSimulado';
import { PayPalSimulado } from '../adaptadores/pagamento/PayPalSimulado';
import { StripeSimulado } from '../adaptadores/pagamento/StripeSimulado';
import { AdaptadorIndeed } from '../adaptadores/profissional/AdaptadorIndeed';
import { AdaptadorInterno } from '../adaptadores/profissional/AdaptadorInterno';
import { AdaptadorLinkedIn } from '../adaptadores/profissional/AdaptadorLinkedIn';
import type { AdaptadorProfissional } from '../adaptadores/profissional/AdaptadorProfissional';
import { IndeedSimulado } from '../adaptadores/profissional/IndeedSimulado';
import { LinkedInSimulado } from '../adaptadores/profissional/LinkedInSimulado';
import type { ProfissionalRepository } from '../domain/ports/ProfissionalRepository';
import type { ProvedorArmazenamento, ProvedorPagamento, ProvedorProfissionais } from './configuracao';

export interface AdaptadoresDoSistema {
  armazenamento: AdaptadorArmazenamento;
  pagamento: AdaptadorPagamento;
  profissional: AdaptadorProfissional;
}

const ARMAZENAMENTO: Readonly<Record<ProvedorArmazenamento, () => AdaptadorArmazenamento>> = {
  local: () => new AdaptadorLocal(new ArmazenamentoExterno()),
  s3: () => new AdaptadorS3(new S3Simulado()),
  google: () => new AdaptadorGoogleCloud(new GoogleCloudStorageSimulado()),
};

const PAGAMENTO: Readonly<Record<ProvedorPagamento, () => AdaptadorPagamento>> = {
  stripe: () => new AdaptadorStripe(new StripeSimulado()),
  pagseguro: () => new AdaptadorPagSeguro(new PagSeguroSimulado()),
  paypal: () => new AdaptadorPayPal(new PayPalSimulado()),
};

const PROFISSIONAIS: Readonly<Record<ProvedorProfissionais, (cadastro: ProfissionalRepository) => AdaptadorProfissional>> = {
  interno: (cadastro) => new AdaptadorInterno(cadastro),
  linkedin: (cadastro) => new AdaptadorLinkedIn(new LinkedInSimulado(cadastro)),
  indeed: (cadastro) => new AdaptadorIndeed(new IndeedSimulado(cadastro)),
};

export function criarAdaptadorArmazenamento(provedor: ProvedorArmazenamento): AdaptadorArmazenamento {
  return ARMAZENAMENTO[provedor]();
}

export function criarAdaptadorPagamento(provedor: ProvedorPagamento): AdaptadorPagamento {
  return PAGAMENTO[provedor]();
}

export function criarAdaptadorProfissional(provedor: ProvedorProfissionais, cadastro: ProfissionalRepository): AdaptadorProfissional {
  return PROFISSIONAIS[provedor](cadastro);
}

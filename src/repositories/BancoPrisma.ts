export interface ClientePrisma {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe(consulta: string): Promise<unknown>;
}

export interface RecursoDeBanco {
  conectar(): Promise<void>;
  verificar(): Promise<boolean>;
  desconectar(): Promise<void>;
}

export class BancoPrisma implements RecursoDeBanco {
  constructor(private readonly cliente: ClientePrisma) {}

  conectar(): Promise<void> {
    return this.cliente.$connect();
  }

  async verificar(): Promise<boolean> {
    await this.cliente.$queryRawUnsafe('SELECT 1');
    return true;
  }

  desconectar(): Promise<void> {
    return this.cliente.$disconnect();
  }
}

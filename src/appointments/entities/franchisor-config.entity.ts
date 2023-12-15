import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'config_franchisor_config' })
export class FranchisorConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  category: string;

  @Column()
  value: string;

  @Column({ type: 'uuid' })
  tenant_id: string;
}

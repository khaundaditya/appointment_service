import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'config_franchisor' })
export class Franchisor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  brand_name: string;

  @Column({ type: 'varchar' })
  domain_name: string;
}

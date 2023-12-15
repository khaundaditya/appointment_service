import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StoreServices } from './service.entity';
@Entity({ name: 'service_options' })
export class ServiceOptions {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  name: string;

  @Column({ type: 'float' })
  price: number;

  @Column({ type: 'varchar' })
  duration: string;

  @ManyToOne(() => StoreServices)
  @JoinColumn({ name: 'service_id', referencedColumnName: 'id' })
  service_id: StoreServices;
}

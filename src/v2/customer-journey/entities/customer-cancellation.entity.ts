import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'customer_cancellationpolicy' })
export class CustomerCancellationpolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'timestamptz' })
  date: Date;

  @Column({ type: 'int' })
  is_accept: number;
}

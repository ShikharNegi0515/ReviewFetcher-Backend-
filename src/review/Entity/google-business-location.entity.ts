import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('google_business_locations')
@Index(['locationId'], { unique: true })
export class GoogleBusinessLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clinicId: number;

  @Column({ length: 100 })
  accountId: string;

  @Column({ length: 255 })
  locationId: string;

  @Column({ length: 255, nullable: true })
  placeId: string;

  @Column({ length: 500, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  mapsUri: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

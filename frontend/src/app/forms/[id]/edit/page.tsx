'use client';

import { useParams } from 'next/navigation';
import FormBuilder from '../../create/page';

export default function FormEditPage() {
  const params = useParams();
  const formId = params.id as string;

  return <FormBuilder formId={formId} />;
}
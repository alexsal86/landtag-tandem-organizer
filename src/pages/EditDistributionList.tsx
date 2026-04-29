import { useParams } from "react-router-dom";
import { DistributionListForm } from "@/features/contacts/components/DistributionListForm";

export default function EditDistributionList() {
  const { id } = useParams<{ id: string }>();
  
  return <DistributionListForm distributionListId={id} />;
}
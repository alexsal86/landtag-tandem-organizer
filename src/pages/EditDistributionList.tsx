import { useParams } from "react-router-dom";
import { DistributionListForm } from "@/components/DistributionListForm";

export default function EditDistributionList() {
  const { id } = useParams<{ id: string }>();
  
  return <DistributionListForm distributionListId={id} />;
}
import StatusCard from '../cards/StatusCard'
import FindingsTable from '../tables/FindingsTable'

function RecentFindings(props) {
  return (
    <StatusCard
      actionLabel="View All Findings"
      id="findings"
      subtitle="Latest detected leaks and exposures."
      title="Recent Findings"
    >
      <FindingsTable {...props} />
    </StatusCard>
  )
}

export default RecentFindings

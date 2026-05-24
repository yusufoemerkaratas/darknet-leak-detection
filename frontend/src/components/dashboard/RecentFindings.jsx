import StatusCard from '../cards/StatusCard'
import FindingsTable from '../tables/FindingsTable'

function RecentFindings({ actions, ...tableProps }) {
  return (
    <StatusCard
      actions={actions}
      id="findings"
      subtitle="Latest detected leaks and exposures."
      title="Recent Findings"
    >
      <FindingsTable {...tableProps} />
    </StatusCard>
  )
}

export default RecentFindings

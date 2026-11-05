import './MetadataBuffering.css'

function MetadataBuffering({ label = 'Loading details' }) {
  return <span className="metadata-buffering" role="status" aria-label={label} />
}

export default MetadataBuffering

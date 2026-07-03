import { vidlinkProvider } from './src/providers/vidlink';
import { config } from './src/config';
import 'dotenv/config';

async function test() {
  console.log('Testing Vidlink provider with key:', config.vidlinkKeyHex.substring(0, 8) + '...');
  
  try {
    const result = await vidlinkProvider.fetchMovie('550');
    if (result) {
      console.log('SUCCESS! Vidlink returned a stream:');
      console.log(result.stream);
      console.log('Quality:', result.quality);
    } else {
      console.log('FAILED! Vidlink returned null (token might be invalid).');
    }
  } catch (error) {
    console.error('ERROR during Vidlink fetch:', error);
  }
}

test();
